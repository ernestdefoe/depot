<?php

namespace ErnestDefoe\Depot\Api\Controller;

use Carbon\Carbon;
use ErnestDefoe\Depot\Api\Concerns;
use ErnestDefoe\Depot\Api\Validates;
use ErnestDefoe\Depot\Job\SyncFile;
use ErnestDefoe\Depot\Model\Category;
use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Service\Changelog;
use ErnestDefoe\Depot\Service\Counters;
use ErnestDefoe\Depot\Service\GitHub;
use ErnestDefoe\Depot\Service\SupportThread;
use ErnestDefoe\Depot\Service\UploadLimit;
use ErnestDefoe\Depot\Storage\Store;
use ErnestDefoe\Depot\Tags\Tags;
use Flarum\User\User;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Create a file (POST /depot/files) or change one (POST /depot/files/{id}).
 *
 * Multipart, because the file and its screenshots travel with the details.
 * Creating also creates the first version; later versions have their own
 * endpoint.
 */
class SaveFileController implements RequestHandlerInterface
{
    use Concerns;
    use Validates;

    public function __construct(
        private Store $store,
        private Counters $counters,
        private Queue $queue,
        private SupportThread $thread,
        private ConnectionInterface $db,
        private UploadLimit $limit,
        private TranslatorInterface $translator,
        private Tags $tags,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $id = Arr::get($request->getQueryParams(), 'id');
        $in = $this->input($request);
        $uploads = $request->getUploadedFiles();

        $creating = $id === null;
        $file = $this->fileFor($actor, $id);

        $this->details($file, $in, $actor, $creating);
        $source = $this->source($file, $in, $creating);
        [$upload, $link] = $this->download($uploads, $in, $creating, $source);

        // Everything that can fail is checked before anything is written.
        $shots = $this->checkedScreenshots($uploads);

        // Approval: moderators and anyone allowed to skip it go straight out.
        if ($creating && ($actor->hasPermission('depot.skipApproval') || $actor->hasPermission('depot.moderate'))) {
            $file->approved_at = Carbon::now();
        }

        if ($creating) {
            $file->slug = File::freeSlug($file->title);
        }

        try {
            $this->db->transaction(function () use ($file, $creating, $in, $source, $upload, $link, $shots) {
                $this->write($file, $creating, $in, $source, $upload, $link, $shots);
            });
        } catch (UniqueConstraintViolationException) {
            // Another file took this slug in the same moment.
            $this->fail('title', 'busy');
        }

        $this->afterSave($file, $creating, $source);

        return new JsonResponse(['slug' => $file->slug, 'approved' => $file->approved_at !== null], $creating ? 201 : 200);
    }

    private const SHOT_BYTES = 20 * 1048576;

    /** A new file for someone allowed to upload, or the existing one they may edit. */
    private function fileFor(User $actor, mixed $id): File
    {
        if ($id === null) {
            $actor->assertRegistered();
            $actor->assertPermission($actor->hasPermission('depot.upload'));
            $this->limit->assertFiles($actor);

            return new File(['user_id' => $actor->id]);
        }

        return $this->editableFile($actor, $id);
    }

    /** Checks and sets where the file's downloads come from (and its repository for GitHub). */
    private function source(File $file, array $in, bool $creating): string
    {
        $source = $creating ? (string) Arr::get($in, 'source', 'upload') : $file->source;
        if (! in_array($source, File::SOURCES, true)) {
            $this->fail('source', 'bad_source');
        }

        $file->source = $source;
        if ($source === 'github') {
            $repo = trim((string) Arr::get($in, 'repo', $file->repo));
            if (! GitHub::validRepo($repo)) {
                $this->fail('repo', 'bad_repo');
            }
            $file->repo = $repo;
        }

        return $source;
    }

    /**
     * The uploaded file and the link, checked to be there when a new file needs one.
     *
     * @return array{0: UploadedFileInterface|null, 1: string}
     */
    private function download(array $uploads, array $in, bool $creating, string $source): array
    {
        $upload = ($uploads['file'] ?? null) instanceof UploadedFileInterface ? $uploads['file'] : null;
        $link = trim((string) Arr::get($in, 'link', ''));
        if ($creating && $source === 'upload' && ! $upload instanceof UploadedFileInterface) {
            $this->fail('file', 'no_file');
        }
        if ($creating && $source === 'link' && ! preg_match(UploadLimit::LINK, $link)) {
            $this->fail('link', 'bad_link');
        }

        return [$upload, $link];
    }

    /**
     * The screenshots sent with the request, each checked before anything is written.
     *
     * @return UploadedFileInterface[]
     */
    private function checkedScreenshots(array $uploads): array
    {
        $shots = $uploads['screenshots'] ?? [];
        $shots = array_values(array_filter(is_array($shots) ? $shots : [$shots], fn ($u) => $u instanceof UploadedFileInterface && $u->getError() !== UPLOAD_ERR_NO_FILE));
        foreach ($shots as $shot) {
            $this->store->checkScreenshot($shot, self::SHOT_BYTES);
        }

        return $shots;
    }

    /** Queues the first GitHub sync, recounts, and starts the support thread once the file is approved. */
    private function afterSave(File $file, bool $creating, string $source): void
    {
        // Releases come in from the queue, so the upload never waits on GitHub.
        if ($creating && $source === 'github') {
            $this->queue->push(new SyncFile($file->id));
        }

        $this->counters->file($file);
        $this->counters->categories();

        if ($file->approved_at) {
            $this->thread->start($file->fresh(['user']));
        }
    }

    private function write(File $file, bool $creating, array $in, string $source, ?UploadedFileInterface $upload, string $link, array $shots): void
    {
        $file->save();

        if ($creating) {
            $version = mb_substr(trim((string) Arr::get($in, 'version', '1.0.0')), 0, 40) ?: '1.0.0';
            if ($source === 'upload') {
                $file->versions()->create(['version' => $version, 'changelog' => ['added' => [], 'changed' => [], 'fixed' => []], 'created_at' => Carbon::now()] + $this->store->putFile($upload));
            } elseif ($source === 'link') {
                $file->versions()->create(['version' => $version, 'url' => $link, 'changelog' => ['added' => [], 'changed' => [], 'fixed' => []], 'created_at' => Carbon::now()]);
            }
        }

        $this->screenshots($file, $shots);
    }

    /** Checks and sets the details people type in: title, category, texts, lists, thread and featured. */
    private function details(File $file, array $in, User $actor, bool $creating): void
    {
        $title = trim((string) Arr::get($in, 'title', $file->title));
        if ($title === '' || mb_strlen($title) > 120) {
            $this->fail('title', 'bad_title');
        }
        $file->title = $title;

        if (array_key_exists('category', $in) || $creating) {
            $this->category($file, $in, $actor);
        }

        $this->texts($file, $in);
        $this->lists($file, $in);

        if ($creating) {
            $this->threadChoice($file, $in, $actor);
        }

        if ($actor->hasPermission('depot.moderate') && array_key_exists('featured', $in)) {
            $file->featured = filter_var($in['featured'], FILTER_VALIDATE_BOOL);
        }
    }

    /** Checks and sets the category: one the actor may use, and never a heading with subcategories. */
    private function category(File $file, array $in, User $actor): void
    {
        $category = Category::tree()->firstWhere('slug', (string) Arr::get($in, 'category'));
        if (! $category || in_array($category->id, Category::lockedFor($actor), true)) {
            $this->fail('category', 'bad_category');
        }
        // A root with children is a heading; files go in its subcategories.
        if (Category::tree()->contains('parent_id', $category->id)) {
            $this->fail('category', 'pick_subcategory');
        }
        $file->category_id = $category->id;
    }

    /** Sets the tagline, game, licence, description, compatibility and install steps that were sent. */
    private function texts(File $file, array $in): void
    {
        foreach (['tagline' => 160, 'game' => 60, 'licence' => 60] as $key => $max) {
            if (array_key_exists($key, $in)) {
                $file->$key = mb_substr(trim((string) $in[$key]), 0, $max) ?: null;
            }
        }

        if (array_key_exists('description', $in)) {
            $file->description = mb_substr(trim((string) $in['description']), 0, 20000) ?: null;
        }

        if (array_key_exists('compat', $in)) {
            $compat = is_array($in['compat']) ? $in['compat'] : explode(',', (string) $in['compat']);
            $file->compat = array_slice(array_values(array_unique(array_filter(array_map(fn ($v) => mb_substr(trim((string) $v), 0, 30), $compat)))), 0, 20);
        }

        if (array_key_exists('install', $in)) {
            $file->install = Changelog::lines($in['install'], 15);
        }
    }

    /** Sets the extra fields and the requirements that were sent, parsed one per line. */
    private function lists(File $file, array $in): void
    {
        // "Label: value", one per line.
        if (array_key_exists('fields', $in)) {
            $file->fields = array_values(array_filter(array_map(function ($line) {
                [$k, $v] = array_pad(explode(':', $line, 2), 2, '');

                return trim($k) !== '' && trim($v) !== '' ? [mb_substr(trim($k), 0, 40), mb_substr(trim($v), 0, 120)] : null;
            }, Changelog::lines($in['fields'], 10))));
        }

        // "Name — what it is for", one per line; "(optional)" anywhere marks it optional.
        if (array_key_exists('requires', $in)) {
            $file->requires = array_map(function ($line) {
                $optional = (bool) preg_match('/\(optional\)/i', $line);
                $line = trim(preg_replace('/\(optional\)/i', '', $line) ?? $line);
                [$name, $note] = array_pad(preg_split('/\s+[—–-]\s+/u', $line, 2) ?: [$line], 2, '');

                return ['name' => mb_substr(trim($name), 0, 80), 'note' => mb_substr(trim($note), 0, 160), 'optional' => $optional];
            }, Changelog::lines($in['requires'], 10));
        }
    }

    /** Sets whether a new file wants a support thread, its opening post and its tag. */
    private function threadChoice(File $file, array $in, User $actor): void
    {
        $file->wants_thread = filter_var(Arr::get($in, 'thread', true), FILTER_VALIDATE_BOOL);
        $file->thread_opening = mb_substr(trim((string) Arr::get($in, 'threadOpening', '')), 0, 5000) ?: null;
        $tag = (int) Arr::get($in, 'threadTag', 0);
        if ($file->wants_thread && $tag) {
            $file->thread_tag_id = $this->tags->startable($tag, $actor) ?? $this->fail('threadTag', 'bad_tag');
        }
    }

    /** @param UploadedFileInterface[] $shots already checked */
    private function screenshots(File $file, array $shots): void
    {
        $have = $file->screenshots()->count();
        $position = (int) $file->screenshots()->max('position');

        foreach (array_slice($shots, 0, max(0, 8 - $have)) as $shot) {
            $file->screenshots()->create(['position' => ++$position] + $this->store->putScreenshot($shot, self::SHOT_BYTES));
        }
    }
}

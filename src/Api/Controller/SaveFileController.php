<?php

namespace ErnestDefoe\Depot\Api\Controller;

use Carbon\Carbon;
use ErnestDefoe\Depot\Api\Concerns;
use ErnestDefoe\Depot\Api\Validates;
use ErnestDefoe\Depot\Job\SyncFile;
use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Service\Counters;
use ErnestDefoe\Depot\Service\FileDetails;
use ErnestDefoe\Depot\Service\GitHub;
use ErnestDefoe\Depot\Service\Screenshots;
use ErnestDefoe\Depot\Service\SupportThread;
use ErnestDefoe\Depot\Service\UploadLimit;
use ErnestDefoe\Depot\Storage\Store;
use Flarum\User\User;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Create a file (POST /depot/files), with its first version.
 *
 * Multipart, because the file and its screenshots travel with the details,
 * so it is not FileResource's Create; changing a file is FileResource's
 * Update, and later versions have their own endpoint.
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
        private FileDetails $details,
        private Screenshots $screenshots,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $in = $this->input($request);
        $uploads = $request->getUploadedFiles();

        $file = $this->newFile($actor);
        $source = $this->source($file, $in);
        $this->details->apply($file, $in, $actor, true);
        [$upload, $link] = $this->download($uploads, $in, $source);

        // Everything that can fail is checked before anything is written.
        $shots = $this->screenshots->checked($uploads);

        // Approval: moderators and anyone allowed to skip it go straight out.
        if ($actor->hasPermission('depot.skipApproval') || $actor->hasPermission('depot.moderate')) {
            $file->approved_at = Carbon::now();
        }
        $file->slug = File::freeSlug($file->title);

        try {
            $this->db->transaction(function () use ($file, $in, $source, $upload, $link, $shots) {
                $this->write($file, $in, $source, $upload, $link, $shots);
            });
        } catch (UniqueConstraintViolationException) {
            // Another file took this slug in the same moment.
            $this->fail('title', 'busy');
        }

        $this->afterSave($file, $source);

        return new JsonResponse(['slug' => $file->slug, 'approved' => $file->approved_at !== null], 201);
    }

    /** A new file, for someone allowed to upload one now. */
    private function newFile(User $actor): File
    {
        $actor->assertRegistered();
        $actor->assertPermission($actor->hasPermission('depot.upload'));
        $this->limit->assertFiles($actor);

        return new File(['user_id' => $actor->id]);
    }

    /** Checks and sets where the file's downloads come from (and its repository for GitHub). */
    private function source(File $file, array $in): string
    {
        $source = (string) Arr::get($in, 'source', 'upload');
        if (! in_array($source, File::SOURCES, true)) {
            $this->fail('source', 'bad_source');
        }

        $file->source = $source;
        if ($source === 'github') {
            $repo = trim((string) Arr::get($in, 'repo', ''));
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
    private function download(array $uploads, array $in, string $source): array
    {
        $upload = ($uploads['file'] ?? null) instanceof UploadedFileInterface ? $uploads['file'] : null;
        $link = trim((string) Arr::get($in, 'link', ''));
        if ($source === 'upload' && ! $upload instanceof UploadedFileInterface) {
            $this->fail('file', 'no_file');
        }
        if ($source === 'link' && ! preg_match(UploadLimit::LINK, $link)) {
            $this->fail('link', 'bad_link');
        }

        return [$upload, $link];
    }

    /** Queues the first GitHub sync, recounts, and starts the support thread once the file is approved. */
    private function afterSave(File $file, string $source): void
    {
        // Releases come in from the queue, so the upload never waits on GitHub.
        if ($source === 'github') {
            $this->queue->push(new SyncFile($file->id));
        }

        $this->counters->file($file);
        $this->counters->categories();

        if ($file->approved_at) {
            $this->thread->start($file->fresh(['user']));
        }
    }

    /** The file, its first version (uploaded or linked; GitHub's come from the sync) and its screenshots. */
    private function write(File $file, array $in, string $source, ?UploadedFileInterface $upload, string $link, array $shots): void
    {
        $file->save();

        $version = mb_substr(trim((string) Arr::get($in, 'version', '1.0.0')), 0, 40) ?: '1.0.0';
        $empty = ['version' => $version, 'changelog' => ['added' => [], 'changed' => [], 'fixed' => []], 'created_at' => Carbon::now()];
        if ($source === 'upload') {
            $file->versions()->create($empty + $this->store->putFile($upload));
        } elseif ($source === 'link') {
            $file->versions()->create($empty + ['url' => $link]);
        }

        $this->screenshots->add($file, $shots);
    }
}

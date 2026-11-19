<?php

namespace ErnestDefoe\Depot\Api\Controller;

use Carbon\Carbon;
use ErnestDefoe\Depot\Api\Concerns;
use ErnestDefoe\Depot\Api\Validates;
use ErnestDefoe\Depot\Job\NotifyWatchers;
use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Service\Changelog;
use ErnestDefoe\Depot\Service\Counters;
use ErnestDefoe\Depot\Service\UploadLimit;
use ErnestDefoe\Depot\Storage\Store;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A new version of a file: its own bytes (or link), its own changelog, and a notification to everyone watching. */
class SaveVersionController implements RequestHandlerInterface
{
    use Concerns;
    use Validates;

    public function __construct(
        private Store $store,
        private Counters $counters,
        private Queue $queue,
        private UploadLimit $limit,
        private TranslatorInterface $translator,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $file = $this->editableFile($actor, Arr::get($request->getQueryParams(), 'id'));
        $in = $this->input($request);

        // Versions count against the same hourly limit as files, per file.
        $this->limit->assertVersions($actor, $file);

        $number = $this->number($file, $in);

        $attrs = [
            'version' => $number,
            'changelog' => [
                'added' => Changelog::lines(Arr::get($in, 'added')),
                'changed' => Changelog::lines(Arr::get($in, 'changed')),
                'fixed' => Changelog::lines(Arr::get($in, 'fixed')),
            ],
            'created_at' => Carbon::now(),
        ];

        $attrs += $this->download($file, $in, $request->getUploadedFiles()['file'] ?? null);

        try {
            $version = $file->versions()->create($attrs);
        } catch (UniqueConstraintViolationException) {
            // The same number, saved in the same moment.
            $this->fail('version', 'duplicate_version', ['version' => $number]);
        }
        $this->counters->file($file);

        // Watchers hear about it once the file is public, never before.
        if ($file->approved_at) {
            $this->queue->push(new NotifyWatchers($version->id, $actor->id));
        }

        return new JsonResponse(['id' => $version->id], 201);
    }

    /** The new version number, checked to be given and not already used by this file. */
    private function number(File $file, array $in): string
    {
        $number = mb_substr(trim((string) Arr::get($in, 'version', '')), 0, 40);
        if ($number === '') {
            $this->fail('version', 'no_version');
        }
        if ($file->versions()->where('version', $number)->exists()) {
            $this->fail('version', 'duplicate_version', ['version' => $number]);
        }

        return $number;
    }

    /**
     * Where the version downloads from: the link for a link file, else the stored upload.
     *
     * @return array<string, mixed>
     */
    private function download(File $file, array $in, mixed $upload): array
    {
        if ($file->source === 'link') {
            $link = trim((string) Arr::get($in, 'link', ''));
            if (! preg_match(UploadLimit::LINK, $link)) {
                $this->fail('link', 'bad_link');
            }

            return ['url' => $link];
        }
        if ($upload instanceof UploadedFileInterface) {
            return $this->store->putFile($upload);
        }
        $this->fail('file', 'no_file');
    }
}

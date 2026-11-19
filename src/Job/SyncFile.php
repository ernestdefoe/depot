<?php

namespace ErnestDefoe\Depot\Job;

use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Service\GitHub;
use Flarum\Queue\AbstractJob;

/**
 * A new GitHub-linked file's first sync, in the queue: the uploader's request
 * never waits on GitHub. A file that misses it (GitHub down or rate-limiting)
 * is first in line for the hourly depot:sync-github run.
 */
class SyncFile extends AbstractJob
{
    public function __construct(private int $fileId)
    {
    }

    public function handle(GitHub $github): void
    {
        $file = File::query()->find($this->fileId);

        if ($file) {
            $github->sync($file);
        }
    }
}

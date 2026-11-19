<?php

namespace ErnestDefoe\Depot\Job;

use ErnestDefoe\Depot\Model\Version;
use ErnestDefoe\Depot\Notification\NewVersion;
use Flarum\Notification\NotificationSyncer;
use Flarum\Queue\AbstractJob;

/**
 * Tells a file's watchers about a new version, in the queue: a popular file
 * can have thousands, and the uploader's save shouldn't wait for them.
 */
class NotifyWatchers extends AbstractJob
{
    public function __construct(private int $versionId, private ?int $exceptUserId = null)
    {
    }

    public function handle(NotificationSyncer $notifications): void
    {
        $version = Version::query()->with('file')->find($this->versionId);
        if (! $version?->file?->approved_at) {
            return;
        }

        $audience = $version->file->audience()
            ->when($this->exceptUserId, fn ($q) => $q->where('users.id', '!=', $this->exceptUserId))
            ->get()->all();

        $notifications->sync(new NewVersion($version), $audience);
    }
}

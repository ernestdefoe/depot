<?php

namespace ErnestDefoe\Depot\Service;

use Carbon\Carbon;
use ErnestDefoe\Depot\Model\File;
use Flarum\Post\Exception\FloodingException;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;

/**
 * Members may add this many files an hour, and this many versions to one
 * file (setting, default 10); moderators are not counted. Enough for anyone
 * publishing a set, too few to fill a disk or bury the approval queue.
 */
class UploadLimit
{
    /** A link a member gives for a file or a version: https, and a host. */
    public const LINK = '#^https://[^\s/$.?\#].[^\s]*$#i';

    public function __construct(private SettingsRepositoryInterface $settings)
    {
    }

    public function assertFiles(User $actor): void
    {
        $this->assert($actor, File::query()->where('user_id', $actor->id)->where('created_at', '>', Carbon::now()->subHour())->count());
    }

    public function assertVersions(User $actor, File $file): void
    {
        $this->assert($actor, $file->versions()->where('created_at', '>', Carbon::now()->subHour())->count());
    }

    private function assert(User $actor, int $recent): void
    {
        if (! $actor->hasPermission('depot.moderate') && $recent >= max(1, (int) $this->settings->get('ernestdefoe-depot.uploads_per_hour'))) {
            throw new FloodingException();
        }
    }
}

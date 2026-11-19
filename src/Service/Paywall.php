<?php

namespace ErnestDefoe\Depot\Service;

use ErnestDefoe\Depot\Model\File;
use Flarum\User\User;

/**
 * Who may download a file. A paid file opens only to its buyers, its
 * uploader and moderators.
 *
 * 🚨 Fails closed: this is the answer without Kiosk, where nobody else holds
 * a paid file. With Kiosk enabled, extend.php binds Kiosk\KioskPaywall in its
 * place, which asks Kiosk who bought it.
 */
class Paywall
{
    /** Whether a file can be sold here at all. */
    public function kioskEnabled(): bool
    {
        return false;
    }

    public function canDownload(File $file, User $actor): bool
    {
        if (! $actor->hasPermission('depot.download')) {
            return false;
        }

        if (! $file->paid || $file->isOwnedBy($actor) || $actor->hasPermission('depot.moderate')) {
            return true;
        }

        return $actor->exists && $this->bought($file, $actor);
    }

    protected function bought(File $file, User $actor): bool
    {
        return false;
    }
}

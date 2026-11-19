<?php

namespace ErnestDefoe\Depot\Service;

use ErnestDefoe\Depot\Model\File;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Contracts\Container\Container;

/**
 * Who may download a file, Kiosk sales included.
 *
 * A paid file opens only to its buyers, its uploader and moderators.
 * 🚨 Fails closed: with Kiosk off, nobody else holds a paid file. Kiosk keeps
 * its answer for the whole request.
 */
class Paywall
{
    public function __construct(private ExtensionManager $extensions, private Container $container)
    {
    }

    public function kioskEnabled(): bool
    {
        return $this->extensions->isEnabled('ernestdefoe-kiosk');
    }

    public function canDownload(File $file, User $actor): bool
    {
        if (! $actor->hasPermission('depot.download')) {
            return false;
        }

        if (! $file->paid || $file->isOwnedBy($actor) || $actor->hasPermission('depot.moderate')) {
            return true;
        }

        // Kiosk's service is built only once Kiosk is known to be enabled, so
        // its classes are never loaded on a forum without it.
        return $actor->exists && $this->kioskEnabled()
            && $this->container->make(\Ernestdefoe\Kiosk\Service\Access::class)->has($actor, 'depot-file', $file->id);
    }
}

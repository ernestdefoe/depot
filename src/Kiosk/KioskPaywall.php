<?php

namespace ErnestDefoe\Depot\Kiosk;

use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Service\Paywall;
use Ernestdefoe\Kiosk\Service\Access;
use Flarum\User\User;

/** Paywall with Kiosk: a paid file also opens to whoever bought it. Bound only while Kiosk is enabled. */
class KioskPaywall extends Paywall
{
    public function __construct(private Access $access)
    {
    }

    public function kioskEnabled(): bool
    {
        return true;
    }

    /** Kiosk keeps its answer for the whole request. */
    protected function bought(File $file, User $actor): bool
    {
        return $this->access->has($actor, 'depot-file', $file->id);
    }
}

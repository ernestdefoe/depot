<?php

namespace ErnestDefoe\Depot\Kiosk;

use ErnestDefoe\Depot\Service\Paywall;
use Flarum\Foundation\AbstractServiceProvider;

/** Registered by extend.php only while Kiosk is enabled. */
class KioskProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        $this->container->bind(Paywall::class, KioskPaywall::class);
    }
}

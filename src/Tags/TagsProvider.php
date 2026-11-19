<?php

namespace ErnestDefoe\Depot\Tags;

use Flarum\Foundation\AbstractServiceProvider;

/** Registered by extend.php only while flarum/tags is enabled. */
class TagsProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        $this->container->bind(Tags::class, TagsEnabled::class);
    }
}

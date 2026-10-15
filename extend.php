<?php

/*
 * Depot — a downloads section for Flarum 2.
 *
 * Prototype: the forum pages run on sample data in js/src/forum/data.js. No
 * tables, no API yet — this is the design to react to before the backend is
 * built.
 */

use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->jsDirectory(__DIR__.'/js/dist/forum')
        ->css(__DIR__.'/less/forum.less')
        // Every route also exists here, so a pasted link loads the page
        // instead of the forum's 404.
        ->route('/downloads', 'depot.index')
        ->route('/downloads/c/{slug}', 'depot.category')
        ->route('/downloads/f/{slug}', 'depot.file'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js'),

    new Extend\Locales(__DIR__.'/locale'),
];

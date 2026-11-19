<?php

/*
 * Depot — a downloads section for Flarum 2.
 */

use ErnestDefoe\Depot\Access\ScopeFileVisibility;
use ErnestDefoe\Depot\Api\Controller;
use ErnestDefoe\Depot\Api\Field\ForumFields;
use ErnestDefoe\Depot\Api\Resource\FileResource;
use ErnestDefoe\Depot\Console\PruneCommand;
use ErnestDefoe\Depot\Console\SyncGitHubCommand;
use ErnestDefoe\Depot\Content\FileMeta;
use ErnestDefoe\Depot\Http\DownloadController;
use ErnestDefoe\Depot\Http\StylesheetController;
use ErnestDefoe\Depot\Listener\ForgetCategoryTree;
use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Notification\FileApproved;
use ErnestDefoe\Depot\Notification\NewVersion;
use ErnestDefoe\Depot\Tags\TagsProvider;
use Flarum\Api\Resource\ForumResource;
use Flarum\Extend;
use Flarum\Foundation\Paths;
use Flarum\Http\UrlGenerator;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Queue\Events\JobProcessing;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->jsDirectory(__DIR__.'/js/dist/forum')
        // Every page route also exists here, so a pasted link loads the page
        // instead of the forum's 404. The file page builds its own link card.
        ->route('/downloads', 'depot.index')
        ->route('/downloads/c/{slug}', 'depot.category')
        ->route('/downloads/f/{slug}', 'depot.file', FileMeta::class),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/less/admin.less'),

    new Extend\Locales(__DIR__.'/locale'),

    // Store extensions add their ProductAccess classes here (Extend\Products).
    (new Extend\ServiceProvider())->register(ErnestDefoe\Depot\Products\ProductServiceProvider::class),

    (new Extend\View())->namespace('ernestdefoe-depot', __DIR__.'/views'),

    /*
     * Two disks (Store::FILES and Store::MEDIA, written out: extend.php must
     * not load Depot's classes while a deploy is updating them). Files are
     * PRIVATE — under storage/, reachable only through the download route —
     * and screenshots are public assets. Either can be
     * pointed at S3 or R2 by overriding the driver.
     */
    (new Extend\Filesystem())
        ->disk('depot-files', fn (Paths $paths) => [
            'root' => "$paths->storage/depot",
            'visibility' => 'private',
        ])
        ->disk('depot-media', fn (Paths $paths, UrlGenerator $url) => [
            'root' => "$paths->public/assets/depot",
            'url' => $url->to('forum')->path('assets/depot'),
            // Explicit: left to the umask, directories come out 0700 and every
            // screenshot is a 403 on hosts where PHP and the web server differ.
            'visibility' => 'public',
            'directory_visibility' => 'public',
        ]),

    (new Extend\Routes('forum'))
        ->get('/downloads/get/{id:[0-9]+}', 'depot.download', DownloadController::class)
        // Depot's page styles, fetched with the page chunk instead of riding
        // in every visitor's forum.css. No .css in the path: nginx configs
        // (Flarum's own example among them) serve *.css as static files and
        // never pass the request to PHP.
        ->get('/downloads/stylesheet', 'depot.css', StylesheetController::class),

    (new Extend\Routes('api'))
        ->get('/depot/browse', 'depot.browse', Controller\BrowseController::class)
        ->get('/depot/file', 'depot.show', Controller\ShowFileController::class)
        ->get('/depot/latest/{slug}', 'depot.latest', Controller\LatestController::class)
        ->post('/depot/files', 'depot.files.create', Controller\SaveFileController::class)
        ->post('/depot/files/{id:[0-9]+}', 'depot.files.update', Controller\SaveFileController::class)
        ->delete('/depot/files/{id:[0-9]+}', 'depot.files.delete', Controller\DeleteFileController::class)
        ->post('/depot/files/{id:[0-9]+}/versions', 'depot.versions.create', Controller\SaveVersionController::class)
        ->delete('/depot/versions/{id:[0-9]+}', 'depot.versions.delete', Controller\DeleteVersionController::class)
        ->post('/depot/files/{id:[0-9]+}/approve', 'depot.files.approve', Controller\ApproveFileController::class)
        ->post('/depot/files/{id:[0-9]+}/feature', 'depot.files.feature', Controller\FeatureFileController::class)
        ->post('/depot/files/{id:[0-9]+}/sell', 'depot.files.sell', Controller\SellFileController::class)
        ->post('/depot/files/{id:[0-9]+}/discussion', 'depot.files.discussion', Controller\LinkDiscussionController::class)
        ->post('/depot/files/{id:[0-9]+}/watch', 'depot.files.watch', Controller\WatchFileController::class)
        ->post('/depot/files/{id:[0-9]+}/review', 'depot.reviews.save', Controller\SaveReviewController::class)
        ->delete('/depot/reviews/{id:[0-9]+}', 'depot.reviews.delete', Controller\DeleteReviewController::class)
        ->post('/depot/reviews/{id:[0-9]+}/reply', 'depot.reviews.reply', Controller\ReplyReviewController::class)
        ->post('/depot/reviews/{id:[0-9]+}/helpful', 'depot.reviews.helpful', Controller\HelpfulReviewController::class)
        ->delete('/depot/screenshots/{id:[0-9]+}', 'depot.screenshots.delete', Controller\DeleteScreenshotController::class)
        // Administration: the controller asserts admin itself.
        ->get('/depot/categories', 'depot.categories', Controller\CategoriesController::class)
        ->post('/depot/categories', 'depot.categories.create', Controller\CategoriesController::class)
        ->post('/depot/categories/order', 'depot.categories.order', Controller\CategoriesController::class)
        ->patch('/depot/categories/{id:[0-9]+}', 'depot.categories.update', Controller\CategoriesController::class)
        ->delete('/depot/categories/{id:[0-9]+}', 'depot.categories.delete', Controller\CategoriesController::class),

    (new Extend\ApiResource(ForumResource::class))->fields(ForumFields::class),

    // Who may open a file: Depot's lists and core's notification list both ask this.
    (new Extend\ModelVisibility(File::class))->scope(ScopeFileVisibility::class),

    // For notifications: a subject without a resource 500s /api/notifications.
    new Extend\ApiResource(FileResource::class),

    (new Extend\Notification())
        ->type(NewVersion::class, ['alert', 'email'])
        ->type(FileApproved::class, ['alert', 'email']),

    (new Extend\Console())
        ->command(SyncGitHubCommand::class)
        ->schedule(SyncGitHubCommand::class, function (Event $event): void {
            $event->hourly()->withoutOverlapping();
        })
        ->command(PruneCommand::class)
        ->schedule(PruneCommand::class, function (Event $event): void {
            $event->daily()->withoutOverlapping();
        }),

    (new Extend\Settings())
        ->default('ernestdefoe-depot.count_window', '24')
        ->default('ernestdefoe-depot.max_upload_mb', '250')
        ->default('ernestdefoe-depot.uploads_per_hour', '10')
        ->default('ernestdefoe-depot.support_thread', '1')
        ->default('ernestdefoe-depot.github_sync', '1')
        // An emptied or zero number field goes back to its default above, so
        // every read can take the stored value as it is.
        ->resetWhen('ernestdefoe-depot.count_window', fn ($v) => (int) $v < 1)
        ->resetWhen('ernestdefoe-depot.max_upload_mb', fn ($v) => (int) $v < 1)
        ->resetWhen('ernestdefoe-depot.uploads_per_hour', fn ($v) => (int) $v < 1)
        ->serializeToForum('depotMaxUploadMb', 'ernestdefoe-depot.max_upload_mb', fn ($v) => max(1, (int) $v))
        ->serializeToForum('depotSupportThread', 'ernestdefoe-depot.support_thread', fn ($v) => $v !== '0'),

    (new Extend\Event())->listen(JobProcessing::class, ForgetCategoryTree::class),

    // Tags for support discussions, only where flarum/tags runs.
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-tags', fn () => [
            (new Extend\ServiceProvider())->register(TagsProvider::class),
        ]),

    // Sell uploaded files through Kiosk; see Kiosk\FileUnlock and Service\Paywall.
    (new Extend\Conditional())
        ->whenExtensionEnabled('ernestdefoe-kiosk', fn () => [
            // Uploaders sell their own files too, where the installed Kiosk has member sellers.
            new \Ernestdefoe\Kiosk\Extend\UnlockType('depot-file', interface_exists(\Ernestdefoe\Kiosk\Unlock\SellableByMembers::class)
                ? \ErnestDefoe\Depot\Kiosk\SellerFileUnlock::class
                : \ErnestDefoe\Depot\Kiosk\FileUnlock::class),
        ]),
];

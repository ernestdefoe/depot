<?php

namespace ErnestDefoe\Depot\Api\Resource;

use ErnestDefoe\Depot\Api\Presenter;
use ErnestDefoe\Depot\Model\File;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Illuminate\Database\Eloquent\Builder;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * Files (type `depot-files`): the downloads list (filters in Search\), a
 * file's page, moderation and watching (FileActions), and deleting.
 *
 * Every read goes through file visibility (Access\ScopeFileVisibility). A
 * list's cards are built in one batch for the page (Presenter::primeCards);
 * the rest of a file's page only where one file is shown. Uploading, being
 * multipart, is SaveFileController.
 *
 * @extends AbstractDatabaseResource<File>
 */
class FileResource extends AbstractDatabaseResource
{
    public const PER_PAGE = 24;

    /** What a card shows: in lists and on the file's page. */
    private const CARD = [
        'slug', 'title', 'tagline', 'category', 'user', 'version', 'downloads', 'rating', 'ratings', 'game', 'compat',
        'source', 'repo', 'package', 'tiers', 'buyUrl', 'host', 'cover', 'icon', 'trend', 'featured', 'paid', 'approved', 'created',
    ];

    /** The rest of a file's page: only where one file is shown. */
    private const PAGE = [
        'related', 'description', 'firstReleased', 'licence', 'fields', 'requires', 'install', 'watchers', 'watching',
        'versions', 'screenshots', 'reviews', 'myReview', 'distribution', 'discussion', 'author', 'access', 'canEdit',
        'canLinkDiscussion', 'canModerate', 'canReview', 'canDownload', 'canSell', 'updateUrl',
    ];

    public function __construct(
        private readonly Presenter $presenter,
        private readonly FileActions $actions,
        private readonly BrowseMeta $browse,
    ) {
    }

    public function type(): string
    {
        return 'depot-files';
    }

    public function model(): string
    {
        return File::class;
    }

    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereVisibleTo($context->getActor());
    }

    /** A file's address is its slug; its number works too. */
    public function find(string $id, OriginalContext $context): ?object
    {
        $query = $this->query($context);

        return ctype_digit($id) ? $query->find((int) $id) : $query->where('slug', $id)->first();
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Index::make()
                ->can('depot.view')
                ->paginate(self::PER_PAGE, self::PER_PAGE)
                ->defaultSort('-releasedAt')
                ->after(function (Context $context, $files) {
                    $this->presenter->primeCards($files);

                    return $files;
                })
                ->meta($this->browseMeta()),
            Endpoint\Show::make()
                ->can('depot.view')
                // For the breadcrumbs, when the page is the first one opened.
                ->meta([Schema\Arr::make('categories')->get(fn (File $f, Context $context) => $this->browse->categories($context))]),
            Endpoint\Update::make()
                ->authenticated(),
            Endpoint\Delete::make()
                ->authenticated(),
        ];
    }

    /**
     * What the downloads page needs beside the files (BrowseMeta), sent as
     * the list's meta so the page is still one request.
     *
     * @return list<Schema\Attribute>
     */
    private function browseMeta(): array
    {
        return [
            Schema\Arr::make('categories')->get(fn (Context $context) => $this->browse->categories($context)),
            Schema\Arr::make('compat')->get(fn (Context $context) => $this->browse->compatFor($context)),
            Schema\Arr::make('featured')->get(fn (Context $context) => $this->browse->featured($context)),
            Schema\Arr::make('locked')->get(fn (Context $context) => $this->browse->lockedFor($context)),
            Schema\Integer::make('pending')->get(fn (Context $context) => $this->browse->pending($context)),
            Schema\Boolean::make('canUpload')->get(fn (Context $context) => $context->getActor()->hasPermission('depot.upload')),
        ];
    }

    public function sorts(): array
    {
        return [
            SortColumn::make('releasedAt'),
            SortColumn::make('downloadCount'),
            SortColumn::make('createdAt'),
            // The average: FileSearcher sorts it.
            SortColumn::make('rating'),
        ];
    }

    public function fields(): array
    {
        // Elsewhere (a notification's subject, say) a file is its title and
        // slug alone: the card is for Depot's own list and page.
        $card = fn (string $key) => Schema\Attribute::make($key)
            ->visible(fn (File $f, Context $context) => in_array($key, ['slug', 'title'], true) || $context->collection instanceof self)
            ->get(fn (File $f) => in_array($key, ['slug', 'title'], true) ? $f->{$key} : $this->presenter->cardOf($f)[$key]);

        $page = fn (string $key) => Schema\Attribute::make($key)
            ->visible(fn (File $f, Context $context) => ! $context->listing())
            ->get(fn (File $f, Context $context) => $this->presenter->pageOf($f, $context->getActor())[$key]);

        return [
            ...array_map($card, self::CARD),
            ...array_map($page, self::PAGE),
            ...$this->actions->fields(),
        ];
    }

    public function updating(object $model, OriginalContext $context): ?object
    {
        /** @var File $model */
        $this->actions->updating($model, $context->getActor());

        return $model;
    }

    public function saved(object $model, OriginalContext $context): ?object
    {
        /** @var File $model */
        $this->actions->saved($model, $context->getActor());

        return $model;
    }

    public function deleting(object $model, OriginalContext $context): void
    {
        /** @var File $model */
        $this->actions->deleting($model, $context->getActor());
    }

    public function deleted(object $model, OriginalContext $context): void
    {
        /** @var File $model */
        $this->actions->deleted($model);
    }
}

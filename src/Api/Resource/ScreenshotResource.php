<?php

namespace ErnestDefoe\Depot\Api\Resource;

use ErnestDefoe\Depot\Model\Screenshot;
use ErnestDefoe\Depot\Storage\Store;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Illuminate\Database\Eloquent\Builder;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * Screenshots (type `depot-screenshots`), read with the file's page.
 * Deleting one is here; adding them travels with the file's own save.
 *
 * @extends AbstractDatabaseResource<Screenshot>
 */
class ScreenshotResource extends AbstractDatabaseResource
{
    use EditableByFile;

    public function __construct(private readonly Store $store)
    {
    }

    public function type(): string
    {
        return 'depot-screenshots';
    }

    public function model(): string
    {
        return Screenshot::class;
    }

    public function scope(Builder $query, OriginalContext $context): void
    {
        $this->onVisibleFiles($query, $context->getActor());
    }

    public function endpoints(): array
    {
        return [Endpoint\Delete::make()->authenticated()];
    }

    public function fields(): array
    {
        return [Schema\Integer::make('position')];
    }

    public function deleting(object $model, OriginalContext $context): void
    {
        /** @var Screenshot $model */
        $this->editableFile($model->file_id, $context->getActor());
    }

    public function deleted(object $model, OriginalContext $context): void
    {
        /** @var Screenshot $model */
        if (! Screenshot::query()->where('path', $model->path)->exists()) {
            $this->store->deleteScreenshot($model->path);
        }
    }
}

<?php

namespace ErnestDefoe\Depot\Api\Resource;

use ErnestDefoe\Depot\Model\Version;
use ErnestDefoe\Depot\Service\Counters;
use ErnestDefoe\Depot\Storage\Store;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Foundation\ValidationException;
use Illuminate\Database\Eloquent\Builder;
use Symfony\Contracts\Translation\TranslatorInterface;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * Versions (type `depot-versions`), read with the file's page. Deleting one
 * is here; adding one, being multipart, is SaveVersionController.
 *
 * @extends AbstractDatabaseResource<Version>
 */
class VersionResource extends AbstractDatabaseResource
{
    use EditableByFile;

    public function __construct(
        private readonly Store $store,
        private readonly Counters $counters,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function type(): string
    {
        return 'depot-versions';
    }

    public function model(): string
    {
        return Version::class;
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
        return [Schema\Str::make('version')];
    }

    public function deleting(object $model, OriginalContext $context): void
    {
        /** @var Version $model */
        $file = $this->editableFile($model->file_id, $context->getActor());

        // The last version is the file: delete the file instead.
        if ($file->versions()->count() < 2) {
            throw new ValidationException(['version' => $this->translator->trans('ernestdefoe-depot.api.last_version')]);
        }
    }

    public function deleted(object $model, OriginalContext $context): void
    {
        /** @var Version $model */
        // Bytes are shared by hash: only remove them when nothing else uses them.
        if ($model->path && ! Version::query()->where('path', $model->path)->exists()) {
            $this->store->files()->delete($model->path);
        }
        if ($model->file) {
            $this->counters->file($model->file);
        }
    }
}

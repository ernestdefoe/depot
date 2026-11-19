<?php

namespace ErnestDefoe\Depot\Api\Resource;

use Carbon\Carbon;
use ErnestDefoe\Depot\Api\Presenter;
use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Model\Review;
use ErnestDefoe\Depot\Service\Counters;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Foundation\ValidationException;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Symfony\Contracts\Translation\TranslatorInterface;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * Reviews (type `depot-reviews`): one per person per file, written, changed
 * and deleted by its author; replied to by the file's uploader; marked
 * helpful by anyone else. Read with the file's page (FileResource).
 *
 * @extends AbstractDatabaseResource<Review>
 */
class ReviewResource extends AbstractDatabaseResource
{
    /** @var \WeakMap<Review, bool> a helpful mark to record once saved */
    private \WeakMap $helpful;

    public function __construct(
        private readonly Counters $counters,
        private readonly Presenter $presenter,
        private readonly TranslatorInterface $translator,
    ) {
        $this->helpful = new \WeakMap();
    }

    public function type(): string
    {
        return 'depot-reviews';
    }

    public function model(): string
    {
        return Review::class;
    }

    /** Reviews of files this person may open. */
    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereIn('file_id', File::query()->whereVisibleTo($context->getActor())->select('depot_files.id'));
    }

    /** Writing a second review of the same file changes the first: one each. */
    public function newModel(OriginalContext $context): object
    {
        $fileId = (int) ($context->body()['data']['attributes']['fileId'] ?? 0);

        return Review::query()->firstOrNew(['file_id' => $fileId, 'user_id' => $context->getActor()->id]);
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Create::make()->authenticated()->can('depot.review'),
            Endpoint\Update::make()->authenticated(),
            Endpoint\Delete::make()->authenticated(),
        ];
    }

    public function fields(): array
    {
        $author = fn (Review $r, Context $context) => $r->user_id === $context->getActor()->id;
        $shown = fn (Review $r, Context $context) => $this->presenter->review($r, $this->markedHelpful($r, $context));

        return [
            Schema\Integer::make('fileId')
                ->property('file_id')
                ->writableOnCreate()
                ->requiredOnCreate(),
            Schema\Integer::make('rating')
                ->writable($author)
                ->rule(fn () => fn ($attribute, $value, $fail) => (int) $value < 1 || (int) $value > 5 ? $fail($this->message('bad_rating')) : null),
            Schema\Str::make('body')
                ->nullable()
                ->writable($author)
                ->set(fn (Review $r, $value) => $r->body = mb_substr(trim((string) $value), 0, 5000) ?: null),
            Schema\Str::make('reply')
                ->nullable()
                ->writable(fn (Review $r, Context $context) => $r->exists && ($r->file?->isOwnedBy($context->getActor()) || $context->getActor()->hasPermission('depot.moderate')))
                ->set(function (Review $r, $value) {
                    $r->reply = mb_substr(trim((string) $value), 0, 3000) ?: null;
                    $r->replied_at = $r->reply ? Carbon::now() : null;
                }),
            Schema\Boolean::make('isHelpful')
                ->visible(false)
                ->writable(fn (Review $r, Context $context) => $r->exists && $r->user_id !== $context->getActor()->id)
                ->set(fn (Review $r, bool $value) => $this->helpful[$r] = $value),
            // As the file's page shows it.
            Schema\Attribute::make('user')->get(fn (Review $r, Context $context) => $shown($r, $context)['user']),
            Schema\Integer::make('helpful')->property('helpful_count'),
            Schema\Boolean::make('helpfulByMe')->get(fn (Review $r, Context $context) => $this->markedHelpful($r, $context)),
            Schema\Str::make('repliedAt')->nullable()->get(fn (Review $r) => $r->replied_at?->toIso8601String()),
            Schema\Str::make('version')->nullable()->get(fn (Review $r) => $r->version?->version),
            Schema\Str::make('date')->nullable()->get(fn (Review $r) => $r->created_at?->toIso8601String()),
        ];
    }

    public function creating(object $model, OriginalContext $context): ?object
    {
        /** @var Review $model */
        $file = File::query()->whereVisibleTo($context->getActor())->find($model->file_id);
        if (! $file || $file->isOwnedBy($context->getActor()) || ! $file->approved_at) {
            throw new ValidationException(['rating' => $this->message('cannot_review')]);
        }
        $model->version_id = $file->latest_version_id;

        return $model;
    }

    protected function saveModel(Model $model, OriginalContext $context): void
    {
        try {
            $model->save();
        } catch (UniqueConstraintViolationException) {
            // A double submit: the other one already saved this review.
            throw new ValidationException(['rating' => $this->message('busy')]);
        }
    }

    public function saved(object $model, OriginalContext $context): ?object
    {
        /** @var Review $model */
        if (isset($this->helpful[$model])) {
            $this->helpful[$model] ? $model->helpfulVoters()->syncWithoutDetaching([$context->getActor()->id]) : $model->helpfulVoters()->detach($context->getActor()->id);
            unset($this->helpful[$model]);
            $model->helpful_count = $model->helpfulVoters()->count();
            $model->saveQuietly();
        }
        $this->counters->file($model->file);

        return $model;
    }

    public function deleting(object $model, OriginalContext $context): void
    {
        /** @var Review $model */
        if ($model->user_id !== $context->getActor()->id && ! $context->getActor()->hasPermission('depot.moderate')) {
            throw new PermissionDeniedException();
        }
    }

    public function deleted(object $model, OriginalContext $context): void
    {
        /** @var Review $model */
        $this->counters->file($model->file);
    }

    private function markedHelpful(Review $r, Context $context): bool
    {
        $actor = $context->getActor();

        return $actor->exists && $r->helpfulVoters()->where('users.id', $actor->id)->exists();
    }

    private function message(string $key): string
    {
        return $this->translator->trans("ernestdefoe-depot.api.$key");
    }
}

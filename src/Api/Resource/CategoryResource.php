<?php

namespace ErnestDefoe\Depot\Api\Resource;

use ErnestDefoe\Depot\Model\Category;
use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Service\Counters;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Foundation\ValidationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use Symfony\Contracts\Translation\TranslatorInterface;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * Categories (type `depot-categories`), administered from the admin page:
 * list, create, change and delete. Visitors get them with the downloads list
 * (BrowseMeta). The drag-and-drop order is OrderCategoriesController: one
 * request for the whole tree.
 *
 * @extends AbstractDatabaseResource<Category>
 */
class CategoryResource extends AbstractDatabaseResource
{
    /** @var \WeakMap<Category, int[]> group ids to sync once the category is saved */
    private \WeakMap $groups;

    public function __construct(private readonly Counters $counters, private readonly TranslatorInterface $translator)
    {
        $this->groups = new \WeakMap();
    }

    public function type(): string
    {
        return 'depot-categories';
    }

    public function model(): string
    {
        return Category::class;
    }

    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->with('groups')->orderBy('position');
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Index::make()->admin(),
            Endpoint\Create::make()->admin(),
            Endpoint\Update::make()->admin(),
            Endpoint\Delete::make()->admin(),
        ];
    }

    public function fields(): array
    {
        return [
            Schema\Str::make('name')
                ->writable()
                ->requiredOnCreate()
                ->set(fn (Category $c, $value) => $c->name = trim((string) $value))
                ->rule(fn () => fn ($attribute, $value, $fail) => trim((string) $value) === '' || mb_strlen(trim((string) $value)) > 80
                    ? $fail($this->message('bad_category_name')) : null),
            Schema\Str::make('slug')
                ->writable()
                ->nullable()
                ->set(fn (Category $c, $value) => $c->slug = Str::slug((string) $value) ?: ''),
            Schema\Str::make('description')
                ->writable()
                ->nullable()
                ->set(fn (Category $c, $value) => $c->description = mb_substr(trim((string) $value), 0, 255) ?: null),
            Schema\Str::make('color')
                ->writable()
                ->nullable()
                ->set(fn (Category $c, $value) => $c->color = preg_match('/^#[0-9a-f]{3,8}$/i', (string) $value) ? $value : null),
            Schema\Str::make('icon')
                ->writable()
                ->nullable()
                ->set(fn (Category $c, $value) => $c->icon = preg_match('/^[a-z0-9 -]{1,60}$/i', (string) $value) ? $value : null),
            Schema\Integer::make('position'),
            Schema\Integer::make('count')->property('file_count'),
            // Two levels: a parent must itself be a root, and never this category.
            Schema\Integer::make('parentId')
                ->property('parent_id')
                ->writable()
                ->nullable()
                ->rule(fn () => fn ($attribute, $value, $fail) => $value && (! ($p = Category::query()->find((int) $value)) || $p->parent_id)
                    ? $fail($this->message('bad_parent')) : null),
            Schema\Arr::make('groupIds')
                ->writable()
                ->get(fn (Category $c) => $c->groups->pluck('id')->values()->all())
                ->set(fn (Category $c, $value) => $this->groups[$c] = array_map('intval', (array) $value)),
            Schema\Arr::make('groups')
                ->get(fn (Category $c) => $c->groups->map(fn ($g) => $g->name_plural ?: $g->name_singular)->values()->all()),
        ];
    }

    public function saving(object $model, OriginalContext $context): ?object
    {
        /** @var Category $model */
        $model->slug = $model->slug ?: (Str::slug($model->name) ?: 'category');
        if (Category::query()->where('slug', $model->slug)->where('id', '!=', $model->id ?? 0)->exists()) {
            throw new ValidationException(['slug' => $this->message('duplicate_slug', ['slug' => $model->slug])]);
        }
        // Two levels: nothing is its own parent, and a category with
        // subcategories stays a root (they would become a third level).
        if ($model->parent_id && ($model->parent_id === $model->id
            || ($model->exists && Category::query()->where('parent_id', $model->id)->exists()))) {
            throw new ValidationException(['parentId' => $this->message('bad_parent')]);
        }
        if (! $model->exists) {
            $model->position = (int) Category::query()->max('position') + 1;
        }

        return $model;
    }

    public function saved(object $model, OriginalContext $context): ?object
    {
        /** @var Category $model */
        if (isset($this->groups[$model])) {
            $model->groups()->sync($this->groups[$model]);
            unset($this->groups[$model]);
            $model->load('groups');
            Category::forget();
        }

        return $model;
    }

    /** Its files and subcategories stay, one level up, rather than vanishing with it: all or nothing. */
    public function delete(object $model, OriginalContext $context): void
    {
        /** @var Category $model */
        $model->getConnection()->transaction(function () use ($model) {
            File::query()->where('category_id', $model->id)->update(['category_id' => $model->parent_id]);
            Category::query()->where('parent_id', $model->id)->update(['parent_id' => null]);
            $model->delete();
        });
    }

    public function deleted(object $model, OriginalContext $context): void
    {
        $this->counters->categories();
    }

    private function message(string $key, array $params = []): string
    {
        return $this->translator->trans("ernestdefoe-depot.api.$key", $params);
    }
}

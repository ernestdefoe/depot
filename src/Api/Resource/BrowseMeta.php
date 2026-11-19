<?php

namespace ErnestDefoe\Depot\Api\Resource;

use ErnestDefoe\Depot\Api\Presenter;
use ErnestDefoe\Depot\Model\Category;
use ErnestDefoe\Depot\Model\File;
use Flarum\Api\Context;
use Flarum\User\User;

/**
 * What the downloads page needs beside the files (FileResource sends it as
 * the list's meta): the categories as this person sees them, the version
 * chips, the spotlight, the locked categories advertised and the
 * moderation count.
 */
class BrowseMeta
{
    public function __construct(private readonly Presenter $presenter)
    {
    }

    /** Every category as this person sees it: which they may open, and who the rest are for. */
    public function categories(Context $context): array
    {
        return Category::tree()
            ->map(fn ($c) => $this->presenter->category($c, Category::lockedFor($context->getActor())))->values()->all();
    }

    /** The version chips for the category being browsed. */
    public function compatFor(Context $context): array
    {
        return $this->compat($context->getActor(), $this->category($context));
    }

    /** The spotlight, on the unfiltered first page of the whole list. */
    public function featured(Context $context): array
    {
        return $this->first($context) && ! $this->category($context)
            ? $this->presenter->cards(File::query()->whereVisibleTo($context->getActor())->whereNotNull('approved_at')
                ->where('featured', true)->orderByDesc('released_at')->take(5)->get())
            : [];
    }

    /** Locked categories advertised, on the first page. */
    public function lockedFor(Context $context): array
    {
        return $this->first($context) ? $this->locked($context->getActor(), $this->category($context)) : [];
    }

    /** Files waiting for approval, for moderators. */
    public function pending(Context $context): int
    {
        return $context->getActor()->hasPermission('depot.moderate') ? File::query()->whereNull('approved_at')->count() : 0;
    }

    private function category(Context $context): ?Category
    {
        $slug = (string) ($this->filters($context)['category'] ?? '');

        return $slug !== '' ? Category::tree()->firstWhere('slug', $slug) : null;
    }

    /** @return array<string, mixed> */
    private function filters(Context $context): array
    {
        $filters = $context->queryParam('filter');

        return is_array($filters) ? $filters : [];
    }

    /** The first page, unsearched and unfiltered beyond a category. */
    private function first(Context $context): bool
    {
        $page = $context->queryParam('page');
        $offset = is_array($page) ? (int) ($page['offset'] ?? 0) : 0;

        return $offset === 0 && array_diff(array_keys($this->filters($context)), ['category']) === [];
    }

    /** The versions files in this view say they work with, newest first, for the filter chips. */
    private function compat(User $actor, ?Category $category): array
    {
        if (! $category) {
            return [];
        }

        $values = File::query()->whereVisibleTo($actor)->whereNotNull('approved_at')
            ->whereIn('category_id', $category->withChildren())
            // The 500 most recent are plenty to find the newest 8 versions.
            ->orderByDesc('released_at')->take(500)
            ->pluck('compat')->flatten()->filter()->unique()->values()->all();

        usort($values, fn ($a, $b) => version_compare((string) $b, (string) $a));

        return array_slice($values, 0, 8);
    }

    /**
     * Locked categories, advertised: a name, a count and who it is for. No
     * file data at all — titles and pictures are what membership buys.
     */
    private function locked(User $actor, ?Category $category): array
    {
        $locked = Category::lockedFor($actor);

        return Category::tree()
            ->filter(fn ($c) => in_array($c->id, $locked, true) && ! $c->parent_id && (! $category || $category->id === $c->id) && $c->file_count > 0)
            ->map(fn ($c) => ['slug' => $c->slug, 'name' => $c->name, 'count' => $c->file_count, 'groups' => $c->lockGroups()->map(fn ($g) => $g->name_plural)->values()])
            ->values()
            ->all();
    }
}

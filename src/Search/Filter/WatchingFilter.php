<?php

namespace ErnestDefoe\Depot\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;

/**
 * `filter[watching]=1`: files the person watches. Nothing for a guest.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class WatchingFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function getFilterKey(): string
    {
        return 'watching';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        /** @var DatabaseSearchState $state */
        $actor = $state->getActor();
        $state->getQuery()->whereIn('depot_files.id', fn ($q) => $q->select('file_id')->from('depot_watchers')->where('user_id', $actor->exists ? $actor->id : 0), 'and', $negate);
    }
}

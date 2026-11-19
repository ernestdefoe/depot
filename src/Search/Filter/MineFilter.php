<?php

namespace ErnestDefoe\Depot\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;

/**
 * `filter[mine]=1`: the person's own files, at any stage. Nothing for a guest.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class MineFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function getFilterKey(): string
    {
        return 'mine';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        /** @var DatabaseSearchState $state */
        $actor = $state->getActor();
        $state->getQuery()->where('depot_files.user_id', $negate ? '!=' : '=', $actor->exists ? $actor->id : 0);
    }
}

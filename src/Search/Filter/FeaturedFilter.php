<?php

namespace ErnestDefoe\Depot\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;

/**
 * `filter[featured]=1`: the files moderators feature in the spotlight.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class FeaturedFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function getFilterKey(): string
    {
        return 'featured';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        /** @var DatabaseSearchState $state */
        $state->getQuery()->where('depot_files.featured', ! $negate);
    }
}

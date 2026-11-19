<?php

namespace ErnestDefoe\Depot\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;

/**
 * `filter[queue]=1`: files waiting for approval, for moderators (ApprovedOnly lets them through).
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class QueueFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function getFilterKey(): string
    {
        return 'queue';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        /** @var DatabaseSearchState $state */
        $state->getQuery()->whereNull('depot_files.approved_at', 'and', $negate);
    }
}

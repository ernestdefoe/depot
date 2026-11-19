<?php

namespace ErnestDefoe\Depot\Search\Filter;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;

/**
 * `filter[compat]=2.x`: files that say they work with that version.
 *
 * The stored JSON holds the value exactly as json_encode writes it, quotes
 * included, so a LIKE on that text matches whole entries only. Not
 * whereJsonContains: on SQLite, Laravel prefixes json_each() with the table
 * prefix and every prefixed forum gets a 500. It reads only the files the
 * other filters leave, a page at a time.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class CompatFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function getFilterKey(): string
    {
        return 'compat';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        /** @var DatabaseSearchState $state */
        $needle = addcslashes((string) json_encode(mb_substr($this->asString($value), 0, 40)), '%_\\');
        $state->getQuery()->where('depot_files.compat', $negate ? 'not like' : 'like', '%'.$needle.'%');
    }
}

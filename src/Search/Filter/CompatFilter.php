<?php

namespace ErnestDefoe\Depot\Search\Filter;

use ErnestDefoe\Depot\Model\File;
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
 * prefix and every prefixed forum gets a 500. It reads every file the other
 * filters leave (a category's approved files: hundreds, not millions).
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
        $value = mb_substr($this->asString($value), 0, 40);
        // MySQL's JSON type keeps "/" and accents as they are; the others
        // keep PHP's escaped spelling. Either one is a match.
        $spellings = array_unique([json_encode($value), json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]);

        $matches = function ($q) use ($spellings) {
            foreach ($spellings as $spelling) {
                File::whereContains($q, 'depot_files.compat', (string) $spelling, false, 'or');
            }
        };

        $negate ? $state->getQuery()->whereNot($matches) : $state->getQuery()->where($matches);
    }
}

<?php

namespace ErnestDefoe\Depot\Search;

use ErnestDefoe\Depot\Model\File;
use Flarum\Search\AbstractFulltextFilter;
use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\SearchState;

/**
 * `filter[q]=words`: a title or tagline containing them (File::scopeMatching).
 *
 * @extends AbstractFulltextFilter<DatabaseSearchState>
 */
class FileFulltext extends AbstractFulltextFilter
{
    public function search(SearchState $state, string $value): void
    {
        /** @var DatabaseSearchState $state */
        /** @var \Illuminate\Database\Eloquent\Builder<File> $query */
        $query = $state->getQuery();
        $query->matching(mb_substr(trim($value), 0, 80), tagline: true);
    }
}

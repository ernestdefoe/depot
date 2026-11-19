<?php

namespace ErnestDefoe\Depot\Search;

use ErnestDefoe\Depot\Model\File;
use Flarum\Search\Database\AbstractSearcher;
use Flarum\Search\Database\DatabaseSearchState;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * The downloads list: files this person may open (ScopeFileVisibility), with
 * the filters in Filter\ and approval applied by ApprovedOnly.
 */
class FileSearcher extends AbstractSearcher
{
    /** @return Builder<File> */
    public function getQuery(User $actor): Builder
    {
        return File::query()->select('depot_files.*')->whereVisibleTo($actor);
    }

    /** "rating" is the average, highest first, with more ratings breaking ties; anything else is a column. */
    protected function applySort(DatabaseSearchState $state, ?array $sort = null, bool $sortIsDefault = false): void
    {
        if (isset($sort['rating'])) {
            $direction = $sort['rating'] === 'asc' ? 'asc' : 'desc';
            // A computed average: no column holds it, and an empty rating counts as 0.
            $state->getQuery()
                ->orderByRaw("case when rating_count = 0 then 0 else rating_sum * 1.0 / rating_count end $direction")
                ->orderBy('rating_count', $direction);
            unset($sort['rating']);
        }

        parent::applySort($state, $sort, $sortIsDefault);
    }
}

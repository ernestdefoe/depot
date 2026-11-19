<?php

namespace ErnestDefoe\Depot\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\SearchCriteria;

/**
 * Everybody else's unapproved files stay in the moderation queue, not in
 * the list: only a moderator's queue and a person's own files show them.
 */
class ApprovedOnly
{
    public function __invoke(DatabaseSearchState $state, SearchCriteria $criteria): void
    {
        $actor = $state->getActor();
        $queue = isset($criteria->filters['queue']) && $actor->hasPermission('depot.moderate');
        $mine = isset($criteria->filters['mine']) && $actor->exists;

        if (! $queue && ! $mine) {
            $state->getQuery()->whereNotNull('depot_files.approved_at');
        }
    }
}

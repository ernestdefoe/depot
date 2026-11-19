<?php

namespace ErnestDefoe\Depot\Access;

use ErnestDefoe\Depot\Model\Category;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Files this person may open.
 *
 * One scope, registered with Extend\ModelVisibility, so every read asks it:
 * Depot's own lists, and core's notification list, which drops a
 * notification whose file this person can no longer open. Approved files
 * outside a locked category, plus the person's own files at any stage, plus
 * everything for a moderator.
 */
class ScopeFileVisibility
{
    /** @param Builder<\ErnestDefoe\Depot\Model\File> $query */
    public function __invoke(User $actor, Builder $query): void
    {
        if ($actor->hasPermission('depot.moderate')) {
            return;
        }

        $query->where(function (Builder $q) use ($actor) {
            $q->whereNotNull('depot_files.approved_at');
            if ($actor->exists) {
                $q->orWhere('depot_files.user_id', $actor->id);
            }
        });

        $locked = Category::lockedFor($actor);
        if ($locked) {
            $query->where(function (Builder $q) use ($locked, $actor) {
                $q->whereNull('depot_files.category_id')->orWhereNotIn('depot_files.category_id', $locked);
                if ($actor->exists) {
                    $q->orWhere('depot_files.user_id', $actor->id);
                }
            });
        }
    }
}

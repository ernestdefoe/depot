<?php

namespace ErnestDefoe\Depot\Tags;

use Flarum\Discussion\Discussion;
use Flarum\User\User;

/**
 * What Depot asks of flarum/tags. Without Tags this answers "no tag"; with
 * it enabled, extend.php binds TagsEnabled in its place, so no Tags class is
 * ever loaded on a forum that doesn't run it.
 */
class Tags
{
    /** The tag's id if this person may start a discussion in it, else null. */
    public function startable(int $id, User $actor): ?int
    {
        return null;
    }

    /** @param int[] $ids */
    public function attach(Discussion $discussion, array $ids): void
    {
    }

    /** @return array{name: string, color: string|null, slug: string}|null the discussion's primary tag */
    public function primary(Discussion $discussion): ?array
    {
        return null;
    }
}

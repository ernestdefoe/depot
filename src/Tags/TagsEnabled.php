<?php

namespace ErnestDefoe\Depot\Tags;

use Flarum\Discussion\Discussion;
use Flarum\Tags\Tag;
use Flarum\User\User;

/** Tags, for forums running flarum/tags (bound by extend.php only then). */
class TagsEnabled extends Tags
{
    public function startable(int $id, User $actor): ?int
    {
        $tag = Tag::query()->find($id);

        return $tag && $actor->can('startDiscussion', $tag) ? $tag->id : null;
    }

    public function attach(Discussion $discussion, array $ids): void
    {
        $discussion->belongsToMany(Tag::class, 'discussion_tag')->sync($ids);
        $discussion->unsetRelation('tags');
    }

    public function primary(Discussion $discussion): ?array
    {
        // A primary tag (no parent) first. A discussion has a handful of tags.
        $tags = $discussion->belongsToMany(Tag::class, 'discussion_tag')->get();
        $tag = $tags->firstWhere('parent_id', null) ?? $tags->first();

        return $tag ? ['name' => $tag->name, 'color' => $tag->color, 'slug' => $tag->slug] : null;
    }
}

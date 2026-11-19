<?php

namespace ErnestDefoe\Depot\Api\Resource;

use ErnestDefoe\Depot\Model\File;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/** A version or screenshot belongs to its file: seen when the file is, changed by whoever may edit it. */
trait EditableByFile
{
    /**
     * @template M of \Illuminate\Database\Eloquent\Model
     * @param Builder<M> $query
     */
    protected function onVisibleFiles(Builder $query, User $actor): void
    {
        $query->whereIn('file_id', File::query()->whereVisibleTo($actor)->select('depot_files.id'));
    }

    protected function editableFile(int $fileId, User $actor): File
    {
        $file = File::query()->whereVisibleTo($actor)->find($fileId);
        if (! $file || ! $file->canEdit($actor)) {
            throw new PermissionDeniedException();
        }

        return $file;
    }
}

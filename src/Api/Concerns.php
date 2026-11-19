<?php

namespace ErnestDefoe\Depot\Api;

use ErnestDefoe\Depot\Model\File;
use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;

/** What every Depot controller needs: who is asking, and the file they mean. */
trait Concerns
{
    protected function actor(ServerRequestInterface $request): User
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertPermission($actor->hasPermission('depot.view'));

        return $actor;
    }

    protected function input(ServerRequestInterface $request): array
    {
        $body = $request->getParsedBody();

        return is_array($body) ? $body : [];
    }

    protected function param(ServerRequestInterface $request, string $key): string
    {
        return (string) Arr::get($request->getQueryParams(), $key, '');
    }

    /** A file this person may see, by id, or a 404 — never a 403 that confirms it exists. */
    protected function visibleFile(User $actor, int|string $id): File
    {
        return File::query()->whereVisibleTo($actor)->findOrFail((int) $id);
    }

    protected function editableFile(User $actor, int|string $id): File
    {
        $file = $this->visibleFile($actor, $id);
        if (! $file->canEdit($actor)) {
            throw new PermissionDeniedException();
        }

        return $file;
    }
}

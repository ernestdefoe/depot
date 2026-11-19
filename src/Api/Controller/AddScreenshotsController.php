<?php

namespace ErnestDefoe\Depot\Api\Controller;

use ErnestDefoe\Depot\Api\Concerns;
use ErnestDefoe\Depot\Service\Screenshots;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Add screenshots to a file (POST /depot/files/{id}/screenshots), for whoever
 * may edit it. Multipart, so not a JSON:API endpoint, like core's avatar upload.
 */
class AddScreenshotsController implements RequestHandlerInterface
{
    use Concerns;

    public function __construct(private Screenshots $screenshots)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $file = $this->editableFile($this->actor($request), Arr::get($request->getQueryParams(), 'id'));

        $this->screenshots->add($file, $this->screenshots->checked($request->getUploadedFiles()));

        return new JsonResponse(['screenshots' => $file->screenshots()->count()], 201);
    }
}

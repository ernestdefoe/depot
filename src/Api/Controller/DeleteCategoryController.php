<?php

namespace ErnestDefoe\Depot\Api\Controller;

use ErnestDefoe\Depot\Model\Category;
use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Service\Counters;
use Flarum\Http\RequestUtil;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** Delete a category, admins only. Its files and subcategories stay, one level up. */
class DeleteCategoryController implements RequestHandlerInterface
{
    public function __construct(private Counters $counters, private ConnectionInterface $db)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();
        $category = Category::query()->findOrFail((int) Arr::get($request->getQueryParams(), 'id'));

        $this->db->transaction(function () use ($category) {
            // Files keep living, in the parent or uncategorised, rather than vanishing with it.
            File::query()->where('category_id', $category->id)->update(['category_id' => $category->parent_id]);
            Category::query()->where('parent_id', $category->id)->update(['parent_id' => null]);
            $category->delete();
        });
        $this->counters->categories();

        return new EmptyResponse(204);
    }
}

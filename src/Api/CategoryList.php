<?php

namespace ErnestDefoe\Depot\Api;

use ErnestDefoe\Depot\Model\Category;
use Laminas\Diactoros\Response\JsonResponse;

/** The admin page's category list, which every category action answers with. */
class CategoryList
{
    public function __construct(private Presenter $presenter)
    {
    }

    public function response(): JsonResponse
    {
        return new JsonResponse(['categories' => Category::query()->with('groups')->orderBy('position')->get()
            ->map(fn ($c) => $this->presenter->category($c))->values()]);
    }
}

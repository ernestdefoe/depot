<?php

namespace ErnestDefoe\Depot\Api\Controller;

use ErnestDefoe\Depot\Api\CategoryList;
use ErnestDefoe\Depot\Api\Concerns;
use ErnestDefoe\Depot\Api\Validates;
use ErnestDefoe\Depot\Model\Category;
use Flarum\Http\RequestUtil;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Create a category (POST) or change one (PATCH), admins only. */
class SaveCategoryController implements RequestHandlerInterface
{
    use Concerns;
    use Validates;

    public function __construct(private CategoryList $list, private ConnectionInterface $db, private TranslatorInterface $translator)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        $id = Arr::get($request->getQueryParams(), 'id');
        $in = $this->input($request);
        $category = $id ? Category::query()->findOrFail((int) $id) : new Category(['position' => (int) Category::query()->max('position') + 1]);
        $this->fill($category, $in);

        $this->db->transaction(function () use ($category, $in) {
            $category->save();
            if (array_key_exists('groups', $in)) {
                $category->groups()->sync(array_map('intval', (array) $in['groups']));
            }
        });

        return $this->list->response();
    }

    private function fill(Category $category, array $in): void
    {
        $name = trim((string) Arr::get($in, 'name', $category->name));
        if ($name === '' || mb_strlen($name) > 80) {
            $this->fail('name', 'bad_category_name');
        }
        $category->name = $name;

        $slug = Str::slug((string) Arr::get($in, 'slug', '') ?: $name) ?: 'category';
        if (Category::query()->where('slug', $slug)->where('id', '!=', $category->id ?? 0)->exists()) {
            $this->fail('slug', 'duplicate_slug', ['slug' => $slug]);
        }
        $category->slug = $slug;

        $category->description = mb_substr(trim((string) Arr::get($in, 'description', $category->description)), 0, 255) ?: null;

        $color = (string) Arr::get($in, 'color', $category->color);
        $category->color = preg_match('/^#[0-9a-f]{3,8}$/i', $color) ? $color : null;

        $icon = (string) Arr::get($in, 'icon', $category->icon);
        $category->icon = preg_match('/^[a-z0-9 -]{1,60}$/i', $icon) ? $icon : null;

        if (array_key_exists('parent', $in)) {
            $parent = $in['parent'] ? Category::query()->find((int) $in['parent']) : null;
            // Two levels: a parent must itself be a root, and never this category.
            if ($parent && ($parent->parent_id || $parent->id === $category->id)) {
                $this->fail('parent', 'bad_parent');
            }
            $category->parent_id = $parent?->id;
        }
    }
}

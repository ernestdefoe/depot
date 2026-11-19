<?php

namespace ErnestDefoe\Depot\Api\Controller;

use ErnestDefoe\Depot\Api\CategoryList;
use ErnestDefoe\Depot\Api\Concerns;
use ErnestDefoe\Depot\Api\Validates;
use ErnestDefoe\Depot\Model\Category;
use Flarum\Http\RequestUtil;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * The admin page's drag-and-drop order: every category's position and
 * parent, checked first and then written together, so a bad row changes
 * nothing.
 */
class OrderCategoriesController implements RequestHandlerInterface
{
    use Concerns;
    use Validates;

    public function __construct(private CategoryList $list, private ConnectionInterface $db, private TranslatorInterface $translator)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        $order = [];
        foreach (array_values((array) Arr::get($this->input($request), 'order', [])) as $position => $row) {
            $order[(int) Arr::get($row, 'id')] = ['position' => $position, 'parent' => (int) Arr::get($row, 'parent') ?: null];
        }

        // Two levels: a parent is never itself a child, and nothing is its own parent.
        foreach ($order as $id => $row) {
            $parent = $row['parent'];
            if ($parent && ($parent === $id || ($order[$parent]['parent'] ?? null) || in_array($id, array_column($order, 'parent'), true))) {
                $this->fail('parent', 'bad_parent');
            }
        }

        // Three statements whatever the size of the tree. Every value in a
        // CASE is a cast integer, never input text. Roots get a plain null:
        // a CASE of nothing but nulls is text to PostgreSQL.
        $roots = array_keys(array_filter($order, fn ($row) => $row['parent'] === null));
        $children = array_diff_key($order, array_flip($roots));

        $this->db->transaction(function () use ($order, $roots, $children) {
            $this->updateEach($order, 'position', fn ($row) => $row['position']);
            Category::query()->whereKey($roots)->update(['parent_id' => null]);
            $this->updateEach($children, 'parent_id', fn ($row) => $row['parent']);
        });
        Category::forget();

        return $this->list->response();
    }

    /** @param array<int, array{position: int, parent: int|null}> $rows */
    private function updateEach(array $rows, string $column, callable $value): void
    {
        if (! $rows) {
            return;
        }

        $id = $this->db->getQueryGrammar()->wrap('id');
        $when = array_map(fn ($key, $row) => 'when '.(int) $key.' then '.(int) $value($row), array_keys($rows), $rows);

        Category::query()->whereKey(array_keys($rows))->update([$column => $this->db->raw("case $id ".implode(' ', $when).' end')]);
    }
}

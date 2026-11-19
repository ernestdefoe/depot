<?php

namespace ErnestDefoe\Depot\Search\Filter;

use ErnestDefoe\Depot\Model\Category;
use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;

/**
 * `filter[category]=slug`: files in that category and its subcategories.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
class CategoryFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public function getFilterKey(): string
    {
        return 'category';
    }

    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        /** @var DatabaseSearchState $state */
        $category = Category::tree()->firstWhere('slug', $this->asString($value));
        $state->getQuery()->whereIn('depot_files.category_id', $category ? $category->withChildren() : [0], 'and', $negate);
    }
}

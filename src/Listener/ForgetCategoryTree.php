<?php

namespace ErnestDefoe\Depot\Listener;

use ErnestDefoe\Depot\Model\Category;

/** Queue workers live for many jobs: each starts with a fresh category tree. */
class ForgetCategoryTree
{
    public function handle(): void
    {
        Category::forget();
    }
}

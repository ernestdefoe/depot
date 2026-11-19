<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/**
 * Three indexes were created with names of their own, which Laravel does not
 * prefix: two installs sharing one database (PostgreSQL and SQLite index
 * names are schema-wide) could not both create them. The create migrations no
 * longer name them; this gives an existing install the same generated names.
 *
 * The new index goes in before the old one comes out. On MySQL a foreign key
 * needs an index starting with its column, and the old index may be the one
 * category_id's and file_id's keys are using.
 */
/** The three indexes: table, columns, and the name they used to have. */
$indexes = [
    ['depot_files', ['category_id', 'approved_at', 'released_at'], 'depot_files_browse'],
    ['depot_files', ['approved_at', 'download_count'], 'depot_files_popular'],
    ['depot_download_log', ['file_id', 'fingerprint', 'created_at'], 'depot_download_log_seen'],
];

/** Make sure $add exists before $drop goes, so a foreign key always has its index. */
$swap = function (Builder $schema, string $table, array $columns, ?string $add, string $drop): void {
    if (! $schema->hasIndex($table, $add ?? $drop)) {
        $schema->table($table, fn (Blueprint $t) => $t->index($columns, $add));
    }
    if ($schema->hasIndex($table, $drop)) {
        $schema->table($table, fn (Blueprint $t) => $t->dropIndex($drop));
    }
};

$generated = fn (Builder $schema, string $table, array $columns) => strtolower($schema->getConnection()->getTablePrefix().$table.'_'.implode('_', $columns).'_index');

return [
    'up' => function (Builder $schema) use ($indexes, $generated) {
        foreach ($indexes as [$table, $columns, $old]) {
            $new = $generated($schema, $table, $columns);
            if (! $schema->hasIndex($table, $new)) {
                $schema->table($table, fn (Blueprint $t) => $t->index($columns));
            }
            if ($schema->hasIndex($table, $old)) {
                $schema->table($table, fn (Blueprint $t) => $t->dropIndex($old));
            }
        }
    },
    // Back to the names the indexes had before (hand-named, as they were then).
    'down' => function (Builder $schema) use ($indexes, $swap, $generated) {
        foreach ($indexes as [$table, $columns, $old]) {
            $swap($schema, $table, $columns, $old, $generated($schema, $table, $columns));
        }
    },
];

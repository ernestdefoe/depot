<?php

namespace ErnestDefoe\Depot\Service;

use ErnestDefoe\Depot\Model\Category;
use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Tags\Tags;
use Flarum\Foundation\ValidationException;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * A file's typed details, checked the same way wherever they are written:
 * the upload (SaveFileController) and an edit (FileResource).
 */
class FileDetails
{
    public function __construct(private TranslatorInterface $translator, private Tags $tags)
    {
    }

    /**
     * Check and set the details a person types in: title, category, texts,
     * lists, the repository of a GitHub file, and (when creating) the
     * support thread. Only the keys present change on an edit.
     */
    public function apply(File $file, array $in, User $actor, bool $creating): void
    {
        $title = trim((string) Arr::get($in, 'title', $file->title ?? ''));
        if ($title === '' || mb_strlen($title) > 120) {
            $this->fail('title', 'bad_title');
        }
        $file->title = $title;

        if (array_key_exists('category', $in) || $creating) {
            $this->category($file, $in, $actor);
        }

        $this->texts($file, $in);
        $this->lists($file, $in);

        if ($creating) {
            $this->threadChoice($file, $in, $actor);
        }

        if ($file->source === 'github' && array_key_exists('repo', $in)) {
            $repo = trim((string) $in['repo']);
            if (! GitHub::validRepo($repo)) {
                $this->fail('repo', 'bad_repo');
            }
            $file->repo = $repo;
        }
    }

    /** Checks and sets the category: one the actor may use, and never a heading with subcategories. */
    private function category(File $file, array $in, User $actor): void
    {
        $category = Category::tree()->firstWhere('slug', (string) Arr::get($in, 'category'));
        if (! $category || in_array($category->id, Category::lockedFor($actor), true)) {
            $this->fail('category', 'bad_category');
        }
        // A root with children is a heading; files go in its subcategories.
        if (Category::tree()->contains('parent_id', $category->id)) {
            $this->fail('category', 'pick_subcategory');
        }
        $file->category_id = $category->id;
    }

    /** Sets the tagline, game, licence, description, compatibility and install steps that were sent. */
    private function texts(File $file, array $in): void
    {
        foreach (['tagline' => 160, 'game' => 60, 'licence' => 60] as $key => $max) {
            if (array_key_exists($key, $in)) {
                $file->$key = mb_substr(trim((string) $in[$key]), 0, $max) ?: null;
            }
        }

        if (array_key_exists('description', $in)) {
            $file->description = mb_substr(trim((string) $in['description']), 0, 20000) ?: null;
        }

        if (array_key_exists('compat', $in)) {
            $compat = is_array($in['compat']) ? $in['compat'] : explode(',', (string) $in['compat']);
            $file->compat = array_slice(array_values(array_unique(array_filter(array_map(fn ($v) => mb_substr(trim((string) $v), 0, 30), $compat)))), 0, 20);
        }

        if (array_key_exists('install', $in)) {
            $file->install = Changelog::lines($in['install'], 15);
        }
    }

    /** Sets the extra fields and the requirements that were sent, parsed one per line. */
    private function lists(File $file, array $in): void
    {
        // "Label: value", one per line.
        if (array_key_exists('fields', $in)) {
            $file->fields = array_values(array_filter(array_map(function ($line) {
                [$k, $v] = array_pad(explode(':', $line, 2), 2, '');

                return trim($k) !== '' && trim($v) !== '' ? [mb_substr(trim($k), 0, 40), mb_substr(trim($v), 0, 120)] : null;
            }, Changelog::lines($in['fields'], 10))));
        }

        // "Name — what it is for", one per line; "(optional)" anywhere marks it optional.
        if (array_key_exists('requires', $in)) {
            $file->requires = array_map(function ($line) {
                $optional = (bool) preg_match('/\(optional\)/i', $line);
                $line = trim(preg_replace('/\(optional\)/i', '', $line) ?? $line);
                [$name, $note] = array_pad(preg_split('/\s+[—–-]\s+/u', $line, 2) ?: [$line], 2, '');

                return ['name' => mb_substr(trim($name), 0, 80), 'note' => mb_substr(trim($note), 0, 160), 'optional' => $optional];
            }, Changelog::lines($in['requires'], 10));
        }
    }

    /** Sets whether a new file wants a support thread, its opening post and its tag. */
    private function threadChoice(File $file, array $in, User $actor): void
    {
        $file->wants_thread = filter_var(Arr::get($in, 'thread', true), FILTER_VALIDATE_BOOL);
        $file->thread_opening = mb_substr(trim((string) Arr::get($in, 'threadOpening', '')), 0, 5000) ?: null;
        $tag = (int) Arr::get($in, 'threadTag', 0);
        if ($file->wants_thread && $tag) {
            $file->thread_tag_id = $this->tags->startable($tag, $actor) ?? $this->fail('threadTag', 'bad_tag');
        }
    }

    private function fail(string $field, string $key, array $params = []): never
    {
        throw new ValidationException([$field => $this->translator->trans("ernestdefoe-depot.api.$key", $params)]);
    }
}

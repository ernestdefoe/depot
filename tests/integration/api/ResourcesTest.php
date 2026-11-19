<?php

namespace ErnestDefoe\Depot\Tests\integration\api;

use Carbon\Carbon;
use ErnestDefoe\Depot\Model\Category;
use ErnestDefoe\Depot\Tests\integration\DepotApi;
use Flarum\Group\Group;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use PHPUnit\Framework\Attributes\Test;

/**
 * The resources' own endpoints: who may change what, and that a list or a
 * file's page costs the same queries however much there is.
 */
class ResourcesTest extends TestCase
{
    use DepotApi;
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-depot');

        $now = Carbon::now();
        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'reviewer', 'email' => 'reviewer@machine.local', 'is_email_confirmed' => 1],
            ],
            Group::class => [['id' => 5, 'name_singular' => 'Insider', 'name_plural' => 'Insiders']],
            'depot_categories' => [
                ['id' => 1, 'name' => 'Maps', 'slug' => 'maps', 'position' => 0, 'file_count' => 1],
                ['id' => 2, 'parent_id' => 1, 'name' => 'Big maps', 'slug' => 'big-maps', 'position' => 1, 'file_count' => 0],
            ],
            'depot_files' => [
                ['id' => 1, 'category_id' => 1, 'user_id' => 2, 'title' => 'Map', 'slug' => 'map', 'source' => 'link', 'approved_at' => $now, 'latest_version_id' => 2, 'wants_thread' => 0, 'created_at' => $now],
            ],
            'depot_versions' => [
                ['id' => 1, 'file_id' => 1, 'version' => '1.0', 'url' => 'https://example.com/1.zip', 'created_at' => $now->copy()->subDay()],
                ['id' => 2, 'file_id' => 1, 'version' => '1.1', 'url' => 'https://example.com/2.zip', 'created_at' => $now],
            ],
            'depot_screenshots' => [['id' => 1, 'file_id' => 1, 'path' => 'ab/cd/shot', 'position' => 1, 'width' => 10, 'height' => 10]],
        ]);
    }

    private function create(int $as, string $type, array $attributes): \Psr\Http\Message\ResponseInterface
    {
        return $this->send($this->request('POST', "/api/$type", [
            'authenticatedAs' => $as,
            'json' => ['data' => ['type' => $type, 'attributes' => $attributes]],
        ]));
    }

    #[Test]
    public function only_moderators_feature_and_anyone_signed_in_watches(): void
    {
        $this->assertSame(403, $this->patch(3, 'depot-files', 1, ['isFeatured' => true]));
        $this->assertSame(200, $this->patch(1, 'depot-files', 1, ['isFeatured' => true]));
        $this->assertTrue($this->page(null, 'map')['featured']);

        $this->assertSame(200, $this->patch(3, 'depot-files', 1, ['isWatching' => true]));
        $page = $this->page(3, 'map');
        $this->assertSame([true, 1], [$page['watching'], $page['watchers']]);
        $this->assertSame(200, $this->patch(3, 'depot-files', 1, ['isWatching' => false]));
        $this->assertFalse($this->page(3, 'map')['watching']);
    }

    #[Test]
    public function its_editors_change_a_files_details_with_the_same_checks_as_an_upload(): void
    {
        $this->assertSame(403, $this->patch(3, 'depot-files', 1, ['title' => 'Mine now']));
        $this->assertSame(200, $this->patch(2, 'depot-files', 1, [
            'title' => 'Bigger map', 'tagline' => 'Now with caves', 'compat' => '1.21, 1.20', 'install' => "Unzip it\nRestart", 'category' => 'big-maps',
        ]));

        $page = $this->page(null, 'map');
        $this->assertSame(['Bigger map', 'Now with caves', ['1.21', '1.20'], ['Unzip it', 'Restart'], 'big-maps'], [$page['title'], $page['tagline'], $page['compat'], $page['install'], $page['category']]);

        // A heading with subcategories, and an empty title, are refused as they are on upload.
        $this->assertSame(422, $this->patch(2, 'depot-files', 1, ['category' => 'maps']));
        $this->assertSame(422, $this->patch(2, 'depot-files', 1, ['title' => '  ']));
    }

    #[Test]
    public function a_file_is_found_by_its_slug_or_number(): void
    {
        $this->assertSame('map', $this->page(null, 1)['slug']);
        $this->assertSame(1, $this->page(null, 'map')['id']);
    }

    #[Test]
    public function the_uploader_replies_to_a_review_and_others_mark_it_helpful(): void
    {
        $this->assertSame(201, $this->review(3, 1, 4, 'Nice.'));
        $id = (int) $this->database()->table('depot_reviews')->value('id');

        $this->assertSame(403, $this->patch(3, 'depot-reviews', $id, ['reply' => 'Thanks me.']), 'the reviewer replying');
        $this->assertSame(200, $this->patch(2, 'depot-reviews', $id, ['reply' => 'Thanks!']));
        $this->assertSame(403, $this->patch(3, 'depot-reviews', $id, ['isHelpful' => true]), 'their own review');
        $this->assertSame(200, $this->patch(2, 'depot-reviews', $id, ['isHelpful' => true]));

        $review = $this->page(3, 'map')['reviews'][0];
        $this->assertSame(['Thanks!', 1], [$review['reply'], $review['helpful']]);

        $this->assertSame(403, $this->remove(2, 'depot-reviews', $id), 'the uploader deleting a review of their file');
        $this->assertSame(204, $this->remove(3, 'depot-reviews', $id));
        $this->assertSame(0, $this->page(null, 'map')['ratings']);
    }

    #[Test]
    public function versions_and_screenshots_are_removed_by_whoever_may_edit_the_file(): void
    {
        $this->assertSame(403, $this->remove(3, 'depot-versions', 1));
        $this->assertSame(204, $this->remove(2, 'depot-versions', 1));
        $this->assertSame(422, $this->remove(2, 'depot-versions', 2), 'the last version');

        $this->assertSame(403, $this->remove(3, 'depot-screenshots', 1));
        $this->assertSame(204, $this->remove(2, 'depot-screenshots', 1));
    }

    #[Test]
    public function admins_create_change_and_delete_categories(): void
    {
        $this->assertSame(403, $this->create(2, 'depot-categories', ['name' => 'Nope'])->getStatusCode());

        $response = $this->create(1, 'depot-categories', ['name' => 'Tools', 'groupIds' => [5]]);
        $this->assertSame(201, $response->getStatusCode());
        $id = (int) $this->decode($response)['data']['id'];
        $this->assertSame(['tools', ['Insiders']], [$this->decode($response)['data']['attributes']['slug'], $this->decode($response)['data']['attributes']['groups']]);

        $this->assertSame(422, $this->create(1, 'depot-categories', ['name' => 'Tools'])->getStatusCode(), 'a taken slug');
        $this->assertSame(200, $this->patch(1, 'depot-categories', $id, ['name' => 'Toolbox', 'parentId' => 1]));
        $this->assertSame(422, $this->patch(1, 'depot-categories', 1, ['parentId' => $id]), 'a parent that is itself a child');
        $this->assertSame(204, $this->remove(1, 'depot-categories', $id));
    }

    #[Test]
    public function a_category_with_subcategories_cannot_become_one(): void
    {
        $this->database()->table('depot_categories')->insert(['id' => 3, 'name' => 'Tools', 'slug' => 'tools', 'position' => 2, 'file_count' => 0]);

        // Maps has Big maps under it: under Tools, Big maps would be a third level.
        $this->assertSame(422, $this->patch(1, 'depot-categories', 1, ['parentId' => 3]));
        $response = $this->send($this->request('POST', '/api/depot/categories/order', [
            'authenticatedAs' => 1,
            'json' => ['order' => [['id' => 3], ['id' => 1, 'parent' => 3], ['id' => 2, 'parent' => 1]]],
        ]));
        $this->assertSame(422, $response->getStatusCode());
    }

    #[Test]
    public function without_the_downloads_section_no_file_is_seen_or_touched(): void
    {
        $this->database()->table('group_permission')->where('permission', 'depot.view')->delete();

        $this->assertSame(404, $this->send($this->request('GET', '/api/depot-files/map'))->getStatusCode());
        $this->assertSame(404, $this->patch(3, 'depot-files', 1, ['isWatching' => true]));
        $this->assertSame(422, $this->review(3, 1, 4));
        // Nor in the page's head for a pasted link.
        $this->assertStringNotContainsString('<title>Map', $this->headOf('/downloads/f/map'));
    }

    private function headOf(string $path): string
    {
        $html = (string) $this->send($this->request('GET', $path))->getBody();

        return (string) preg_replace('#<body.*#s', '', $html);
    }

    #[Test]
    public function a_review_needs_a_rating(): void
    {
        $this->assertSame(422, $this->send($this->request('POST', '/api/depot-reviews', [
            'authenticatedAs' => 3,
            'json' => ['data' => ['type' => 'depot-reviews', 'attributes' => ['fileId' => 1, 'body' => 'No stars.']]],
        ]))->getStatusCode());
    }

    #[Test]
    public function the_update_check_is_shared_by_caches_only_for_guests(): void
    {
        $guest = $this->send($this->request('GET', '/api/depot/latest/map'));
        $member = $this->send($this->request('GET', '/api/depot/latest/map', ['authenticatedAs' => 3]));

        $this->assertStringStartsWith('public', $guest->getHeaderLine('Cache-Control'));
        $this->assertStringStartsWith('private', $member->getHeaderLine('Cache-Control'));
    }

    #[Test]
    public function notifications_about_files_cost_the_same_queries_however_many(): void
    {
        $db = $this->app()->getContainer()->make(ConnectionInterface::class);
        $notify = function (array $ids) use ($db) {
            foreach ($ids as $id) {
                $db->table('notifications')->insert(['user_id' => 3, 'from_user_id' => 2, 'type' => 'depotNewVersion', 'subject_id' => $id, 'data' => json_encode(['version' => '1.0']), 'created_at' => Carbon::now()]);
            }
        };
        $count = function () use ($db) {
            $db->flushQueryLog();
            $db->enableQueryLog();
            $response = $this->send($this->request('GET', '/api/notifications', ['authenticatedAs' => 3]));
            $this->assertSame(200, $response->getStatusCode());
            $n = count($db->getQueryLog());
            $db->disableQueryLog();

            return $n;
        };

        $now = Carbon::now();
        foreach (range(10, 29) as $id) {
            $db->table('depot_files')->insert(['id' => $id, 'category_id' => 1, 'user_id' => 2, 'title' => "Map $id", 'slug' => "map-$id", 'source' => 'link', 'approved_at' => $now, 'wants_thread' => 0, 'created_at' => $now]);
        }

        $notify([10, 11]);
        $count();
        $few = $count();
        $notify(range(12, 29));

        $this->assertLessThanOrEqual($few, $count());
    }

    #[Test]
    public function the_list_and_a_page_cost_the_same_queries_however_many_files(): void
    {
        $db = $this->app()->getContainer()->make(ConnectionInterface::class);
        $count = function (callable $request) use ($db) {
            foreach (['all' => null, 'locked' => []] as $property => $empty) {
                (new \ReflectionProperty(Category::class, $property))->setValue(null, $empty);
            }
            $db->flushQueryLog();
            $db->enableQueryLog();
            $request();
            $n = count($db->getQueryLog());
            $db->disableQueryLog();

            return $n;
        };
        $measure = fn (?int $as) => [
            $count(fn () => $this->browse($as)),
            $count(fn () => $this->page($as, 'map')),
        ];

        $now = Carbon::now();
        $add = function (array $ids) use ($db, $now) {
            foreach ($ids as $id) {
                $db->table('depot_files')->insert(['id' => $id, 'category_id' => 1, 'user_id' => 3, 'title' => "Map $id", 'slug' => "map-$id", 'source' => 'link', 'approved_at' => $now, 'latest_version_id' => $id, 'wants_thread' => 0, 'created_at' => $now]);
                $db->table('depot_versions')->insert(['id' => $id, 'file_id' => $id, 'version' => '1.0', 'url' => 'https://example.com/x.zip', 'created_at' => $now]);
                $db->table('depot_screenshots')->insert(['file_id' => $id, 'path' => "x/$id", 'position' => 1, 'width' => 10, 'height' => 10]);
            }
        };

        // Enough files that the page has its three related ones; then 50 more.
        $add(range(10, 12));
        // The first request also stamps last_seen_at and reads asset revisions.
        $measure(2);
        $few = ['guest' => $measure(null), 'member' => $measure(2)];

        $add(range(13, 62));

        // Never more (a full page can even skip a count): nothing is asked per file.
        foreach (['guest' => $measure(null), 'member' => $measure(2)] as $who => [$list, $page]) {
            $this->assertLessThanOrEqual($few[$who][0], $list, "$who: the list");
            $this->assertLessThanOrEqual($few[$who][1], $page, "$who: a file's page");
        }
    }
}

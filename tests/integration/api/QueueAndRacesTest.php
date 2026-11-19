<?php

namespace ErnestDefoe\Depot\Tests\integration\api;

use Carbon\Carbon;
use ErnestDefoe\Depot\Job\NotifyWatchers;
use ErnestDefoe\Depot\Job\SyncFile;
use ErnestDefoe\Depot\Model\Category;
use ErnestDefoe\Depot\Tests\integration\DepotApi;
use Flarum\Group\Group;
use Flarum\Testing\integration\ConsoleTestCase;
use Flarum\User\User;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Queue\SyncQueue;
use PHPUnit\Framework\Attributes\Test;

/**
 * Slow work leaves the request (GitHub's first sync, watcher notifications),
 * maintenance runs on a schedule, and the writes that can race either
 * can't (one statement) or say so (a validation error, never a 500).
 */
class QueueAndRacesTest extends ConsoleTestCase
{
    use DepotApi;

    /** @var array<int, object> jobs pushed while a test runs */
    private array $pushed = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-depot');

        $now = Carbon::now();
        $this->prepareDatabase([
            User::class => [
                ['id' => 2, 'username' => 'normal', 'email' => 'normal@machine.local', 'is_email_confirmed' => 1],
                ['id' => 3, 'username' => 'watcher', 'email' => 'watcher@machine.local', 'is_email_confirmed' => 1],
                ['id' => 4, 'username' => 'outsider', 'email' => 'outsider@machine.local', 'is_email_confirmed' => 1],
            ],
            Group::class => [['id' => 5, 'name_singular' => 'Insider', 'name_plural' => 'Insiders']],
            'group_user' => [['user_id' => 3, 'group_id' => 5]],
            'group_permission' => [['group_id' => Group::MEMBER_ID, 'permission' => 'depot.skipApproval']],
            'depot_categories' => [
                ['id' => 1, 'name' => 'Maps', 'slug' => 'maps', 'position' => 0, 'file_count' => 1],
                ['id' => 2, 'name' => 'Vault', 'slug' => 'vault', 'position' => 1, 'file_count' => 0],
                ['id' => 3, 'name' => 'Tools', 'slug' => 'tools', 'position' => 2, 'file_count' => 0],
            ],
            'depot_files' => [
                ['id' => 1, 'category_id' => 1, 'user_id' => 2, 'title' => 'Map', 'slug' => 'map', 'source' => 'link', 'approved_at' => $now, 'latest_version_id' => 1, 'wants_thread' => 0, 'created_at' => $now],
            ],
            'depot_versions' => [['id' => 1, 'file_id' => 1, 'version' => '1.0', 'url' => 'https://example.com/map.zip', 'created_at' => $now]],
            'depot_watchers' => [['file_id' => 1, 'user_id' => 3], ['file_id' => 1, 'user_id' => 4]],
        ]);
    }

    /** Record pushed jobs, then run them as the sync queue would; GitHub's is only recorded, so no test calls GitHub. */
    private function recordJobs(): void
    {
        $test = $this;
        $queue = new class($test) extends SyncQueue {
            public function __construct(private QueueAndRacesTest $test)
            {
                parent::__construct();
            }

            public function push($job, $data = '', $queue = null)
            {
                $this->test->pushedJob($job);

                return $job instanceof SyncFile ? null : parent::push($job, $data, $queue);
            }
        };
        $queue->setContainer($this->app()->getContainer());
        $this->app()->getContainer()->instance(Queue::class, $queue);
    }

    public function pushedJob(object $job): void
    {
        $this->pushed[] = $job;
    }

    private function call(string $method, string $path, int $as, array $json = []): \Psr\Http\Message\ResponseInterface
    {
        return $this->send($this->request($method, $path, ['authenticatedAs' => $as, 'json' => $json]));
    }

    #[Test]
    public function a_github_files_first_sync_is_queued_not_run_in_the_request(): void
    {
        $this->recordJobs();
        // An invalid repository name never reaches GitHub, and fails validation first.
        $this->assertSame(422, $this->call('POST', '/api/depot/files', 2, ['source' => 'github', 'repo' => 'not a repo', 'title' => 'Tool', 'category' => 'tools'])->getStatusCode());
        $this->assertSame([], $this->pushed);

        $response = $this->call('POST', '/api/depot/files', 2, ['source' => 'github', 'repo' => 'acme/tool', 'title' => 'Tool', 'category' => 'tools', 'thread' => '0']);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertCount(1, $this->pushed);
        $this->assertInstanceOf(SyncFile::class, $this->pushed[0]);
    }

    #[Test]
    public function a_new_version_tells_watchers_from_the_queue_and_only_those_who_may_open_it(): void
    {
        $this->recordJobs();
        $response = $this->call('POST', '/api/depot/files/1/versions', 2, ['version' => '1.1', 'link' => 'https://example.com/map-1.1.zip']);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertInstanceOf(NotifyWatchers::class, $this->pushed[0]);

        $db = $this->database();
        $this->assertEqualsCanonicalizing([3, 4], $db->table('notifications')->where('type', 'depotNewVersion')->pluck('user_id')->map(fn ($id) => (int) $id)->all());

        // The file moves to a category for Insiders: the outsider's
        // notification no longer lists it, the insider's still does.
        $db->table('depot_category_groups')->insert(['category_id' => 2, 'group_id' => 5]);
        $db->table('depot_files')->where('id', 1)->update(['category_id' => 2]);

        $listed = fn (int $as) => count(json_decode((string) $this->send($this->request('GET', '/api/notifications', ['authenticatedAs' => $as]))->getBody(), true)['data']);
        $this->assertSame(1, $listed(3));
        $this->assertSame(0, $listed(4));
    }

    #[Test]
    public function watchers_of_a_members_only_category_hear_of_new_versions(): void
    {
        $this->database()->table('depot_category_groups')->insert(['category_id' => 2, 'group_id' => Group::MEMBER_ID]);
        $this->database()->table('depot_files')->where('id', 1)->update(['category_id' => 2]);

        $this->assertSame(201, $this->call('POST', '/api/depot/files/1/versions', 2, ['version' => '1.1', 'link' => 'https://example.com/map-1.1.zip'])->getStatusCode());
        $this->assertEqualsCanonicalizing([3, 4], $this->database()->table('notifications')->where('type', 'depotNewVersion')->pluck('user_id')->map(fn ($id) => (int) $id)->all());
    }

    #[Test]
    public function a_duplicate_version_is_a_validation_error(): void
    {
        $this->assertSame(422, $this->call('POST', '/api/depot/files/1/versions', 2, ['version' => '1.0', 'link' => 'https://example.com/again.zip'])->getStatusCode());
    }

    #[Test]
    public function a_second_review_replaces_the_first_in_one_row(): void
    {
        $this->assertSame(201, $this->review(3, 1, 2));
        $this->assertSame(201, $this->review(3, 1, 5, 'Better now.'));

        $rows = $this->database()->table('depot_reviews')->where('file_id', 1)->get();
        $this->assertCount(1, $rows);
        $this->assertSame([5, 'Better now.'], [(int) $rows[0]->rating, $rows[0]->body]);
    }

    #[Test]
    public function two_downloads_on_one_day_add_to_one_day_row(): void
    {
        $this->send($this->request('GET', '/downloads/get/1', ['authenticatedAs' => 3]));
        $this->send($this->request('GET', '/downloads/get/1', ['authenticatedAs' => 4]));

        $days = $this->database()->table('depot_download_days')->where('file_id', 1)->get();
        $this->assertCount(1, $days);
        $this->assertSame(2, (int) $days[0]->count);
    }

    #[Test]
    public function a_missing_salt_is_made_rather_than_a_known_key_used(): void
    {
        $this->app()->getContainer()->make('flarum.settings')->delete('ernestdefoe-depot.salt');
        $this->send($this->request('GET', '/downloads/get/1', ['authenticatedAs' => 3]));

        $salt = (string) $this->database()->table('settings')->where('key', 'ernestdefoe-depot.salt')->value('value');
        $this->assertSame(64, strlen($salt));
    }

    #[Test]
    public function the_prune_command_forgets_old_fingerprints_and_days(): void
    {
        $db = $this->database();
        $db->table('depot_download_log')->insert([
            ['file_id' => 1, 'fingerprint' => str_repeat('a', 64), 'created_at' => Carbon::now()->subDays(3)],
            ['file_id' => 1, 'fingerprint' => str_repeat('b', 64), 'created_at' => Carbon::now()],
        ]);
        $db->table('depot_download_days')->insert([
            ['file_id' => 1, 'day' => Carbon::today()->subDays(120)->toDateString(), 'count' => 4],
            ['file_id' => 1, 'day' => Carbon::today()->toDateString(), 'count' => 1],
        ]);

        $this->runCommand(['command' => 'depot:prune']);

        $this->assertSame([str_repeat('b', 64)], $db->table('depot_download_log')->pluck('fingerprint')->all());
        $this->assertSame(1, $db->table('depot_download_days')->count());
    }

    #[Test]
    public function an_emptied_number_setting_goes_back_to_its_default(): void
    {
        $response = $this->send($this->request('POST', '/api/settings', ['authenticatedAs' => 1, 'json' => ['ernestdefoe-depot.uploads_per_hour' => '']]));
        $this->assertSame(204, $response->getStatusCode());

        $this->assertNull($this->database()->table('settings')->where('key', 'ernestdefoe-depot.uploads_per_hour')->value('value'));
        $this->assertSame('10', $this->app()->getContainer()->make('flarum.settings')->get('ernestdefoe-depot.uploads_per_hour'));
    }

    #[Test]
    public function a_bad_row_in_a_reorder_changes_nothing(): void
    {
        // Two good rows first, then one that is its own parent.
        $response = $this->call('POST', '/api/depot/categories/order', 1, ['order' => [['id' => 3], ['id' => 1], ['id' => 2, 'parent' => 2]]]);
        $this->assertSame(422, $response->getStatusCode());

        $this->assertSame([0, 1, 2], $this->database()->table('depot_categories')->orderBy('id')->pluck('position')->map(fn ($p) => (int) $p)->all());
        $this->assertSame(0, $this->database()->table('depot_categories')->whereNotNull('parent_id')->count());
    }

    #[Test]
    public function a_reorder_is_written_in_the_same_queries_however_many_categories(): void
    {
        $db = $this->app()->getContainer()->make(ConnectionInterface::class);
        $count = function (array $order) use ($db) {
            Category::forget();
            $db->flushQueryLog();
            $db->enableQueryLog();
            $response = $this->call('POST', '/api/depot/categories/order', 1, ['order' => $order]);
            $writes = count(array_filter($db->getQueryLog(), fn ($q) => str_starts_with(strtolower($q['query']), 'update')));
            $db->disableQueryLog();
            $this->assertSame(204, $response->getStatusCode());

            return $writes;
        };

        // The first request also stamps the admin's last_seen_at.
        $count([['id' => 1], ['id' => 2], ['id' => 3]]);
        $few = $count([['id' => 3], ['id' => 1], ['id' => 2, 'parent' => 1]]);
        $this->assertSame([[3, 0, null], [1, 1, null], [2, 2, 1]], $db->table('depot_categories')->orderBy('position')->get()
            ->map(fn ($c) => [(int) $c->id, (int) $c->position, $c->parent_id === null ? null : (int) $c->parent_id])->all());

        foreach (range(10, 29) as $id) {
            $db->table('depot_categories')->insert(['id' => $id, 'name' => "Extra $id", 'slug' => "extra-$id", 'position' => $id, 'file_count' => 0]);
        }
        $many = $count(array_merge([['id' => 1], ['id' => 2, 'parent' => 1], ['id' => 3]], array_map(fn ($id) => ['id' => $id, 'parent' => $id % 2 ? 3 : null], range(10, 29))));

        $this->assertSame($few, $many);
    }

    #[Test]
    public function deleting_a_category_moves_its_files_up(): void
    {
        $db = $this->database();
        $db->table('depot_categories')->where('id', 2)->update(['parent_id' => 1]);
        $db->table('depot_files')->where('id', 1)->update(['category_id' => 2]);

        $this->assertSame(204, $this->remove(1, 'depot-categories', 2));
        $this->assertSame(1, (int) $db->table('depot_files')->where('id', 1)->value('category_id'));
        $this->assertSame(1, (int) $db->table('depot_categories')->where('id', 1)->value('file_count'));
    }
}

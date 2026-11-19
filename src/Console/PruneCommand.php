<?php

namespace ErnestDefoe\Depot\Console;

use Carbon\Carbon;
use Flarum\Console\AbstractCommand;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;

/**
 * Daily: forget download fingerprints older than the counting window, and
 * daily totals older than the 90 days the trend shows.
 */
class PruneCommand extends AbstractCommand
{
    public function __construct(private ConnectionInterface $db, private SettingsRepositoryInterface $settings)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('depot:prune')->setDescription('Forget old Depot download fingerprints and daily totals');
    }

    protected function fire(): int
    {
        $hours = max(1, (int) $this->settings->get('ernestdefoe-depot.count_window'));

        $log = $this->db->table('depot_download_log')->where('created_at', '<', Carbon::now()->subHours($hours))->delete();
        $days = $this->db->table('depot_download_days')->where('day', '<', Carbon::today()->subDays(90)->toDateString())->delete();

        $this->info("Pruned $log fingerprints and $days daily totals.");

        return 0;
    }
}

<?php

namespace ErnestDefoe\Depot\Service;

use Carbon\Carbon;
use ErnestDefoe\Depot\Model\Version;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;

/**
 * Counting a download, once.
 *
 * A repeat by the same member — or, for a guest, the same address — inside
 * the window is not counted again, so a download count means people, not
 * clicks. The address is never stored: only a keyed hash of it, and only for
 * as long as the window lasts (depot:prune forgets it daily).
 */
class Downloads
{
    public function __construct(
        private ConnectionInterface $db,
        private SettingsRepositoryInterface $settings,
        private Cache $cache,
    ) {
    }

    public function count(Version $version, User $actor, string $ip): bool
    {
        $hours = max(1, (int) $this->settings->get('ernestdefoe-depot.count_window'));
        $who = $actor->exists ? 'u'.$actor->id : 'a'.$ip;
        $fingerprint = hash_hmac('sha256', $who, $this->salt());

        // Two clicks at once from the same person: the second finds the lock
        // taken and counts as the repeat it is.
        $lock = $this->cache->getStore()->lock("depot-download:{$version->file_id}:$fingerprint", 10);
        if (! $lock->get()) {
            return false;
        }

        try {
            $seen = $this->db->table('depot_download_log')
                ->where('file_id', $version->file_id)
                ->where('fingerprint', $fingerprint)
                ->where('created_at', '>=', Carbon::now()->subHours($hours))
                ->exists();

            if ($seen) {
                return false;
            }

            $this->db->transaction(function () use ($version, $fingerprint) {
                $this->db->table('depot_download_log')->insert([
                    'file_id' => $version->file_id,
                    'fingerprint' => $fingerprint,
                    'created_at' => Carbon::now(),
                ]);

                $this->db->table('depot_versions')->where('id', $version->id)->increment('download_count');
                $this->db->table('depot_files')->where('id', $version->file_id)->increment('download_count');

                // One statement, so two first downloads of the day both count.
                $count = $this->db->getQueryGrammar()->wrap('count');
                $this->db->table('depot_download_days')->upsert(
                    ['file_id' => $version->file_id, 'day' => Carbon::today()->toDateString(), 'count' => 1],
                    ['file_id', 'day'],
                    ['count' => $this->db->raw("$count + 1")],
                );
            });
        } finally {
            $lock->release();
        }

        return true;
    }

    /**
     * The key for the fingerprints. Made on first use if the install never
     * stored one, so a guest's address is never hashed with a known key.
     */
    private function salt(): string
    {
        $salt = (string) $this->settings->get('ernestdefoe-depot.salt');
        if ($salt === '') {
            $salt = bin2hex(random_bytes(32));
            $this->settings->set('ernestdefoe-depot.salt', $salt);
        }

        return $salt;
    }
}

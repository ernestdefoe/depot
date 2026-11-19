<?php

namespace ErnestDefoe\Depot\Kiosk;

use ErnestDefoe\Depot\Model\File;
use Ernestdefoe\Kiosk\Model\Product;
use Ernestdefoe\Kiosk\Unlock\SellableByMembers;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Files their uploaders may sell themselves, through Kiosk Sellers: an
 * approved upload of their own. Registered instead of FileUnlock only when
 * the installed Kiosk knows about member sellers (see extend.php), so an
 * older Kiosk never meets an interface it doesn't have.
 */
class SellerFileUnlock extends FileUnlock implements SellableByMembers
{
    public function owns(User $seller, int $targetId): bool
    {
        return $seller->exists && File::query()->whereKey($targetId)
            ->where('user_id', $seller->id)->where('source', File::SELLABLE)->whereNotNull('approved_at')->exists()
            // Not a file the forum sells itself: its uploader can't undercut it.
            && ! $this->sellingIt($targetId)->whereNull('seller_id')->exists();
    }

    public function searchOwn(User $seller, string $query, int $limit): array
    {
        return File::query()
            ->where('user_id', $seller->id)
            ->where('source', File::SELLABLE)
            ->whereNotNull('approved_at')
            ->when($query !== '', fn ($q) => $q->matching($query))
            ->orderBy('title')
            ->limit($limit)
            ->get(['id', 'title'])
            ->map(fn (File $f) => ['id' => (int) $f->id, 'label' => (string) $f->title])
            ->all();
    }

    /**
     * Its listing was rejected or deleted: the file goes back to free unless
     * something else still sells it (another approved listing, or the forum).
     */
    public function release(int $targetId): void
    {
        $stillSold = $this->sellingIt($targetId)->where('is_active', true)->whereNull('review')->exists();

        if (! $stillSold) {
            File::query()->whereKey($targetId)->update(['paid' => false]);
        }
    }

    /**
     * Kiosk products that sell this file, through Kiosk's own models.
     *
     * @return Builder<Product>
     */
    private function sellingIt(int $fileId): Builder
    {
        return Product::query()->whereHas('unlocks', fn ($q) => $q->where('type', 'depot-file')->where('target_id', $fileId));
    }
}

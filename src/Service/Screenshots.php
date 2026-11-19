<?php

namespace ErnestDefoe\Depot\Service;

use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Storage\Store;
use Psr\Http\Message\UploadedFileInterface;

/** A file's screenshots from an upload: up to eight, each checked before anything is stored. */
class Screenshots
{
    public const MAX = 8;

    private const BYTES = 20 * 1048576;

    public function __construct(private Store $store)
    {
    }

    /**
     * The screenshots in a request's uploads, each checked.
     *
     * @return UploadedFileInterface[]
     */
    public function checked(array $uploads): array
    {
        $shots = $uploads['screenshots'] ?? [];
        $shots = array_values(array_filter(is_array($shots) ? $shots : [$shots], fn ($u) => $u instanceof UploadedFileInterface && $u->getError() !== UPLOAD_ERR_NO_FILE));
        foreach ($shots as $shot) {
            $this->store->checkScreenshot($shot, self::BYTES);
        }

        return $shots;
    }

    /** @param UploadedFileInterface[] $shots already checked */
    public function add(File $file, array $shots): void
    {
        $have = $file->screenshots()->count();
        $position = (int) $file->screenshots()->max('position');

        foreach (array_slice($shots, 0, max(0, self::MAX - $have)) as $shot) {
            $file->screenshots()->create(['position' => ++$position] + $this->store->putScreenshot($shot, self::BYTES));
        }
    }
}

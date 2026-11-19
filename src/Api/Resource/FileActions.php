<?php

namespace ErnestDefoe\Depot\Api\Resource;

use Carbon\Carbon;
use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Model\Version;
use ErnestDefoe\Depot\Notification\FileApproved;
use ErnestDefoe\Depot\Service\Counters;
use ErnestDefoe\Depot\Service\FileDetails;
use ErnestDefoe\Depot\Service\Paywall;
use ErnestDefoe\Depot\Service\SupportThread;
use ErnestDefoe\Depot\Storage\Store;
use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Foundation\ValidationException;
use Flarum\Notification\NotificationSyncer;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * What can be done to a file through FileResource's Update and Delete:
 * approve, feature, sell, watch, link its support discussion, and delete.
 * Each is a writable attribute, so its permission sits beside it.
 */
class FileActions
{
    /** @var \WeakMap<File, array{approve?: bool, watch?: bool}> what a save must do once it lands */
    private \WeakMap $after;

    /** @var \WeakMap<File, array<string, mixed>> typed details sent in this update, checked together */
    private \WeakMap $details;

    /** @var \WeakMap<File, array{paths: array<mixed>, shots: array<mixed>}> stored bytes a delete frees */
    private \WeakMap $stored;

    public function __construct(
        private readonly Counters $counters,
        private readonly SupportThread $thread,
        private readonly NotificationSyncer $notifications,
        private readonly Paywall $paywall,
        private readonly Store $store,
        private readonly TranslatorInterface $translator,
        private readonly FileDetails $fileDetails,
    ) {
        $this->after = new \WeakMap();
        $this->details = new \WeakMap();
        $this->stored = new \WeakMap();
    }

    /** @return list<Schema\Attribute> */
    public function fields(): array
    {
        $moderator = fn (File $f, Context $context) => $context->getActor()->hasPermission('depot.moderate');

        return [
            // Approval only goes one way; a moderator removes a file by deleting it.
            Schema\Boolean::make('isApproved')
                ->visible(false)
                ->writable(fn (File $f, Context $context) => $moderator($f, $context) && ! $f->approved_at)
                ->set(function (File $f, bool $value) {
                    if ($value) {
                        $f->approved_at = Carbon::now();
                        $this->after[$f] = ['approve' => true] + ($this->after[$f] ?? []);
                    }
                }),
            Schema\Boolean::make('isFeatured')
                ->visible(false)
                ->writable($moderator)
                ->set(fn (File $f, bool $value) => $f->featured = $value),
            // Sold through Kiosk: only an upload, and only while Kiosk runs. Making it free always works.
            Schema\Boolean::make('isPaid')
                ->visible(false)
                ->writable($moderator)
                ->set(function (File $f, bool $value) {
                    if ($value && ($f->source !== File::SELLABLE || ! $this->paywall->kioskEnabled())) {
                        throw new PermissionDeniedException();
                    }
                    $f->paid = $value;
                }),
            Schema\Boolean::make('isWatching')
                ->visible(false)
                ->writable(fn (File $f, Context $context) => $context->getActor()->exists)
                ->set(fn (File $f, bool $value) => $this->after[$f] = ['watch' => $value] + ($this->after[$f] ?? [])),
            // "139", "/d/139", "https://forum/d/139-some-slug", "https://forum/d/139/4", or "" to unlink.
            Schema\Str::make('linkDiscussion')
                ->visible(false)
                ->writable(fn (File $f, Context $context) => $f->canLinkDiscussion($context->getActor()))
                ->set(fn (File $f, ?string $value, Context $context) => $this->link($f, trim((string) $value), $context->getActor())),
        ];
    }

    /**
     * A detail the file's editors may change (title, texts, lists,
     * category, repository): kept until the update is checked as a whole.
     */
    public function editable(Schema\Attribute $attribute, string $key): Schema\Attribute
    {
        return $attribute
            ->writable(fn (File $f, Context $context) => $f->canEdit($context->getActor()))
            ->set(fn (File $f, mixed $value) => $this->details[$f] = [$key => $value] + ($this->details[$f] ?? []));
    }

    /** An update is for its editors, its moderators, and (for watching alone) anyone who can see it. */
    public function updating(File $file, User $actor): void
    {
        $actor->assertRegistered();

        if (isset($this->details[$file])) {
            $this->fileDetails->apply($file, $this->details[$file], $actor, false);
            unset($this->details[$file]);
        }
    }

    public function saved(File $file, User $actor): void
    {
        $after = $this->after[$file] ?? [];
        unset($this->after[$file]);

        if (array_key_exists('watch', $after)) {
            $after['watch'] ? $file->watchers()->syncWithoutDetaching([$actor->id]) : $file->watchers()->detach($actor->id);
            $this->counters->file($file);
        }

        if (! empty($after['approve'])) {
            $this->counters->categories();
            $this->thread->start($file->fresh(['user']));
            if ($file->user && $file->user_id !== $actor->id) {
                $this->notifications->sync(new FileApproved($file), [$file->user]);
            }
        }
    }

    public function deleting(File $file, User $actor): void
    {
        if (! $file->canEdit($actor)) {
            throw new PermissionDeniedException();
        }

        $this->stored[$file] = [
            'paths' => $file->versions()->whereNotNull('path')->pluck('path')->all(),
            'shots' => $file->screenshots()->pluck('path')->all(),
        ];
    }

    public function deleted(File $file): void
    {
        ['paths' => $paths, 'shots' => $shots] = $this->stored[$file] ?? ['paths' => [], 'shots' => []];
        unset($this->stored[$file]);

        // Stored by content, so another file may hold the same bytes: keep those.
        $shared = Version::query()->whereIn('path', $paths)->pluck('path')->all();
        foreach (array_diff(array_unique($paths), $shared) as $path) {
            $this->store->files()->delete($path);
        }
        foreach ($shots as $shot) {
            $this->store->deleteScreenshot($shot);
        }

        $this->counters->categories();
    }

    private function link(File $file, string $given, User $actor): void
    {
        $id = null;
        if ($given !== '') {
            $number = preg_match('#^(?:(\d+)|.*?/d/(\d+)(?:[-/?\#].*)?)$#', $given, $m) ? (int) ($m[1] ?: $m[2]) : 0;
            // Only one the person linking it can see: a link must not reveal,
            // or point people at, a discussion they could not open themselves.
            $discussion = $number ? Discussion::query()->whereVisibleTo($actor)->find($number) : null;
            if (! $discussion) {
                throw new ValidationException(['linkDiscussion' => $this->translator->trans('ernestdefoe-depot.api.bad_discussion')]);
            }
            $id = $discussion->id;
        }

        $file->discussion_id = $id;
        // Linked or deliberately unlinked: either way Depot must not start one later.
        $file->wants_thread = false;
    }
}

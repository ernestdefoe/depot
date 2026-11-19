<?php

namespace ErnestDefoe\Depot\Service;

use ErnestDefoe\Depot\Model\File;
use ErnestDefoe\Depot\Tags\Tags;
use Flarum\Api\JsonApi;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Discussion\Discussion;
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * The file's support discussion: started as the uploader, in the tag they
 * chose, the first time the file is public.
 *
 * Started through core's own discussion endpoint, as the uploader, so it
 * meets every check a discussion from the composer does (tag permissions,
 * required tags, approval) and every extension hears of it as usual. Its id
 * is stored on the file: a generated post is never found again by its text.
 */
class SupportThread
{
    public function __construct(
        private JsonApi $api,
        private UrlGenerator $url,
        private TranslatorInterface $translator,
        private SettingsRepositoryInterface $settings,
        private LoggerInterface $log,
        private Tags $tags,
    ) {
    }

    /** Never lets a refused discussion undo the file's save: the refusal is logged. */
    public function start(File $file): void
    {
        if ($file->discussion_id || ! $file->wants_thread || ! $file->approved_at || ! $file->user) {
            return;
        }

        if ($this->settings->get('ernestdefoe-depot.support_thread') === '0') {
            return;
        }

        $data = ['type' => 'discussions', 'attributes' => [
            'title' => mb_substr($this->translator->trans('ernestdefoe-depot.api.thread_title', ['title' => $file->title]), 0, 80),
            'content' => $this->body($file),
        ]];
        // The chosen tag, while Tags still runs; core decides if one is required.
        if ($file->thread_tag_id && $this->tags->enabled()) {
            $data['relationships']['tags']['data'] = [['type' => 'tags', 'id' => (string) $file->thread_tag_id]];
        }

        try {
            /** @var Discussion $discussion */
            $discussion = $this->api->forResource(DiscussionResource::class)
                ->forEndpoint('create')
                ->process(['data' => $data], [], ['actor' => $file->user]);
        } catch (\Throwable $e) {
            $this->log->warning("[depot] support discussion for {$file->slug} not started: ".$e->getMessage());

            return;
        }

        $file->discussion_id = $discussion->id;
        $file->saveQuietly();
    }

    private function body(File $file): string
    {
        $link = $this->url->to('forum')->route('depot.file', ['slug' => $file->slug]);
        $body = $this->translator->trans('ernestdefoe-depot.api.thread_body', ['title' => $file->title, 'url' => $link]);
        if ($file->thread_opening) {
            $body .= "\n\n".$file->thread_opening;
        }

        // Plain text: a forum may run neither Markdown nor BBCode, and core
        // links the address on its own.
        if ($file->install) {
            $body .= "\n\n".$this->translator->trans('ernestdefoe-depot.api.thread_install')."\n";
            foreach (array_values($file->install) as $i => $step) {
                $body .= ($i + 1).'. '.$step."\n";
            }
        }

        return $body;
    }
}

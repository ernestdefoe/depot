<?php

namespace ErnestDefoe\Depot\Service;

use Carbon\Carbon;
use ErnestDefoe\Depot\Model\File;
use Flarum\Discussion\Discussion;
use Flarum\Http\UrlGenerator;
use Flarum\Post\CommentPost;
use Flarum\Settings\SettingsRepositoryInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * The file's support discussion: started as the uploader, in the tag they
 * chose, the first time the file is public.
 *
 * Its id is stored on the file. A generated post is never found again by its
 * text — posts hold parsed XML, not what was written.
 */
class SupportThread
{
    public function __construct(
        private UrlGenerator $url,
        private TranslatorInterface $translator,
        private SettingsRepositoryInterface $settings,
    ) {
    }

    public function start(File $file): void
    {
        if ($file->discussion_id || ! $file->wants_thread || ! $file->approved_at || ! $file->user) {
            return;
        }

        if ($this->settings->get('ernestdefoe-depot.support_thread') === '0') {
            return;
        }

        $author = $file->user;
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

        $title = mb_substr($this->translator->trans('ernestdefoe-depot.api.thread_title', ['title' => $file->title]), 0, 80);

        $discussion = Discussion::start($title, $author);
        $discussion->save();

        $post = new CommentPost();
        $post->discussion_id = $discussion->id;
        $post->user_id = $author->id;
        $post->type = CommentPost::$type;
        $post->created_at = Carbon::now();
        $post->setContentAttribute($body, $author);
        $post->save();

        $discussion->setFirstPost($post)->setLastPost($post);
        $discussion->comment_count = 1;
        $discussion->participant_count = 1;
        $discussion->save();

        if ($file->thread_tag_id) {
            try {
                $discussion->tags()->sync([$file->thread_tag_id]);
            } catch (\BadMethodCallException) {
                // flarum/tags was switched off after the file was uploaded.
            }
        }

        $file->discussion_id = $discussion->id;
        $file->saveQuietly();
    }
}

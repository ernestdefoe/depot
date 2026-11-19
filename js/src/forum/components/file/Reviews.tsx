import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import { api, number } from '../../depot-api';
import { t, Stars, Avatar } from '../bits';
import ReviewModal from '../ReviewModal';
import type FilePage from '../FilePage';
import type { DepotFile, DepotReview } from '../../types';
import { when } from './shared';

function bars(page: FilePage, file: DepotFile) {
  const total = file.distribution.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="DepotReviews-bars">
      {file.distribution.map((n, i) => {
        const star = 5 - i;
        return (
          <button
            type="button"
            className={`DepotReviews-bar ${page.starFilter === star ? 'is-active' : ''}`}
            onclick={() => (page.starFilter = page.starFilter === star ? 0 : star)}
            aria-pressed={page.starFilter === star ? 'true' : 'false'}
          >
            <span>
              {star} <Icon name="fas fa-star" />
            </span>
            <span className="DepotReviews-track">
              <i style={{ width: `${(n / total) * 100}%` }} />
            </span>
            <span className="Depot-dim">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

function writeButton(page: FilePage, file: DepotFile) {
  const write = () => app.modal.show(ReviewModal, { file, review: file.myReview, onsave: () => page.load() });
  if (file.canReview) {
    return (
      <Button className="Button Button--primary" icon={file.myReview ? 'fas fa-pen' : 'far fa-star'} onclick={write}>
        {file.myReview ? t('file.edit_review') : t('file.write_review')}
      </Button>
    );
  }
  return !app.session.user ? (
    <Button className="Button" onclick={() => app.modal.show(() => import('flarum/forum/components/LogInModal'))}>
      {t('file.login_to_review')}
    </Button>
  ) : (
    <span />
  );
}

export function reviews(page: FilePage, file: DepotFile) {
  const shown = file.reviews.filter((r) => !page.starFilter || r.rating === page.starFilter);

  return (
    <div className="DepotReviews">
      <div className="DepotReviews-summary">
        <div className="DepotReviews-score">
          {/* A file with ratings always has a rating. */}
          <b>{file.ratings ? file.rating!.toFixed(1) : '–'}</b>
          {/* Stars draws a null rating (none yet) as empty stars. */}
          {Stars({ value: file.rating as number, size: 'Depot-stars--large' })}
          <span className="Depot-dim">{t('file.ratings', { count: number(file.ratings) })}</span>
        </div>
        {bars(page, file)}
        {writeButton(page, file)}
      </div>

      {shown.length ? (
        shown.map((r) => page.reviewItem(file, r))
      ) : (
        <p className="Depot-dim DepotReviews-none">{file.reviews.length ? t('file.no_reviews_filtered') : t('file.no_reviews')}</p>
      )}
    </div>
  );
}

function authorReply(file: DepotFile, r: DepotReview) {
  return (
    <div className="DepotReview-reply">
      {Avatar({ user: file.user, className: 'Avatar--mini' })}
      <div>
        <b>{file.user ? file.user.displayName : ''}</b> <span className="Depot-pill">{t('file.author')}</span>
        <p>{r.reply}</p>
      </div>
    </div>
  );
}

function helpfulControl(page: FilePage, r: DepotReview, mine: boolean) {
  if (app.session.user && !mine) {
    return (
      <button
        type="button"
        className={`DepotReview-helpful ${r.helpfulByMe ? 'is-active' : ''}`}
        aria-pressed={r.helpfulByMe ? 'true' : 'false'}
        onclick={() => page.helpful(r)}
      >
        <Icon name={r.helpfulByMe ? 'fas fa-thumbs-up' : 'far fa-thumbs-up'} /> {t('file.helpful', { count: r.helpful })}
      </button>
    );
  }
  return r.helpful ? <span className="Depot-dim">{t('file.helpful', { count: r.helpful })}</span> : null;
}

function reviewActions(page: FilePage, file: DepotFile, r: DepotReview, mine: boolean) {
  return (
    <div className="DepotReview-actions">
      {helpfulControl(page, r, mine)}
      {file.canEdit && !mine && page.replying !== r.id ? (
        <button
          type="button"
          className="Button Button--link Button--small"
          onclick={() => ((page.replying = r.id), (page.replyText = r.reply || ''))}
        >
          {r.reply ? t('file.edit_reply') : t('file.reply')}
        </button>
      ) : null}
      {mine || file.canModerate ? (
        <button type="button" className="Button Button--link Button--small" onclick={() => page.removeReview(r)}>
          {t('file.delete_review')}
        </button>
      ) : null}
    </div>
  );
}

export function reviewItem(page: FilePage, file: DepotFile, r: DepotReview) {
  const me = app.session.user;
  const mine = !!(me && r.user && String(r.user.id) === me.id());
  return (
    <article className="DepotReview">
      {Avatar({ user: r.user })}
      <div className="DepotReview-body">
        <header>
          <b>{r.user ? r.user.displayName : '?'}</b>
          {Stars({ value: r.rating })}
          <span className="Depot-dim">
            {when(r.date)}
            {r.version ? [' · ', t('file.reviewed_version', { version: r.version })] : null}
          </span>
        </header>
        {r.body ? <p>{r.body}</p> : null}
        {page.replying === r.id ? page.replyEditor(r) : r.reply ? authorReply(file, r) : null}
        {reviewActions(page, file, r, mine)}
      </div>
    </article>
  );
}

export function replyEditor(page: FilePage, r: DepotReview) {
  const save = () =>
    api.post<{ reply: string | null }>(`reviews/${r.id}/reply`, { reply: page.replyText }).then((res) => {
      r.reply = res.reply;
      page.replying = null;
      m.redraw();
    });
  return (
    <div className="DepotReview-replyEditor">
      <textarea
        className="FormControl"
        rows="3"
        aria-label={t('file.reply')}
        placeholder={t('file.reply_placeholder').toString()}
        value={page.replyText}
        oninput={(e: InputEvent) => (page.replyText = (e.target as HTMLTextAreaElement).value)}
        oncreate={(vnode) => (vnode.dom as HTMLElement).focus()}
      />
      <div>
        <Button className="Button Button--primary Button--small" onclick={save}>
          {t('file.reply_save')}
        </Button>
        <Button className="Button Button--link Button--small" onclick={() => (page.replying = null)}>
          {t('file.cancel')}
        </Button>
      </div>
    </div>
  );
}

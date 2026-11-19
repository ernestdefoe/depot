import type Mithril from 'mithril';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import humanTime from 'flarum/common/helpers/humanTime';
import type Post from 'flarum/common/models/Post';
import { t } from '../bits';
import type FilePage from '../FilePage';
import type { DepotDiscussion, DepotFile } from '../../types';

function threadCard(d: DepotDiscussion) {
  return (
    <div className="DepotThread">
      <Icon name="far fa-comments" />
      <div>
        <b>{d.title}</b>
        <span className="Depot-dim">
          {t('file.thread_meta', { count: d.replies })}
          {d.tag
            ? [
                ' · ',
                <span className="Depot-label" style={{ '--label-color': d.tag.color || 'var(--control-color)' } as Mithril.Attributes['style']}>
                  {d.tag.name}
                </span>,
              ]
            : null}
        </span>
      </div>
      <a className="Button" href={d.url}>
        {t('file.thread_open')}
      </a>
    </div>
  );
}

function post(p: Post) {
  const user = p.user();
  return (
    <article className="DepotPost">
      <header>
        {user ? <img className="Avatar Avatar--mini" src={user.avatarUrl() || ''} hidden={!user.avatarUrl()} alt="" /> : null}
        <b>{user ? user.displayName() : ''}</b>
        <span className="Depot-dim">{humanTime(p.createdAt())}</span>
      </header>
      {/* Flarum's own rendered post, exactly as the discussion shows it. */}
      <div className="Post-body">{m.trust(p.contentHtml())}</div>
    </article>
  );
}

export function discussion(page: FilePage, file: DepotFile) {
  const d = file.discussion;
  if (!d) return <p className="Depot-dim DepotReviews-none">{file.approved ? t('file.no_thread') : t('file.thread_after_approval')}</p>;
  if (!page.posts) page.loadPosts(d);

  return (
    <div className="DepotDiscussion">
      {threadCard(d)}
      {page.posts === 'loading' ? <LoadingIndicator /> : null}
      {Array.isArray(page.posts) ? page.posts.map(post) : null}
      <a className="DepotReply" href={d.url}>
        <Icon name="fas fa-reply" />
        <span>{t('file.reply_in_thread')}</span>
      </a>
    </div>
  );
}

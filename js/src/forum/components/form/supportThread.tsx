import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import { t } from '../bits';

/*
 * The upload form's support-discussion step: which tag it goes in, and a
 * preview of how it will look.
 */

/** The flarum/tags model methods read here; flarum/tags ships no typings for core to see. */
interface TagModel {
  id(): string;
  name(): string;
  color(): string | null;
  icon(): string | null;
  description(): string | null;
  isPrimary(): boolean;
  parent(): unknown;
  canStartDiscussion(): boolean;
}

export interface TagChoice {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
}

export interface Thread {
  on: boolean;
  tag: string | null;
  opening: string;
}

/** The forum's primary tags the member may start a discussion in, from the boot payload. */
export function supportTags(): TagChoice[] {
  return ((app.store.all('tags') || []) as unknown as TagModel[])
    .filter((tag) => tag.isPrimary() && !tag.parent() && tag.canStartDiscussion())
    .map((tag) => ({
      id: tag.id(),
      name: tag.name(),
      color: tag.color() || 'var(--control-color)',
      icon: tag.icon(),
      description: tag.description(),
    }));
}

/** One button per tag the support discussion can go in. */
export function tagPicker(th: Thread, tags: TagChoice[]) {
  return (
    <div className="DepotTagPick" role="radiogroup">
      {tags.map((tag) => (
        <button
          type="button"
          role="radio"
          aria-checked={th.tag === tag.id ? 'true' : 'false'}
          className={th.tag === tag.id ? 'is-active' : ''}
          style={{ '--label-color': tag.color }}
          onclick={() => (th.tag = tag.id)}
        >
          <span className="DepotTagPick-icon">{tag.icon ? <Icon name={tag.icon} /> : null}</span>
          <span>
            <b>{tag.name}</b>
            {tag.description ? <span className="Depot-dim">{tag.description}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

/** How the support discussion will look in the discussion list. */
export function threadPreview(fileTitle: string, chosen: TagChoice | undefined) {
  const user = app.session.user;
  return (
    <div className="DepotThreadPreview">
      <span className="Depot-dim">{t('upload.thread_preview')}</span>
      <div className="DepotThreadPreview-item">
        <span className="Avatar Avatar--mini" style={{ '--avatar-bg': user ? user.color() : 'var(--control-bg)' }}>
          {user ? user.displayName().charAt(0).toUpperCase() : '?'}
        </span>
        <div>
          <b>{t('upload.thread_title', { title: fileTitle || '…' })}</b>
          <div className="DepotThreadPreview-meta">
            {chosen ? (
              <span className="Depot-label" style={{ '--label-color': chosen.color }}>
                {chosen.name}
              </span>
            ) : null}
            <span className="Depot-badge">
              <Icon name="fas fa-box-open" /> {t('upload.thread_linked')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

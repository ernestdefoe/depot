import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import { number } from '../../depot-api';
import { t, Stars, UserChip, CategoryLabels, SourceBadge, Cover, coverStyle, PriceBadge } from '../bits';
import EditFileModal from '../EditFileModal';
import VersionModal from '../VersionModal';
import LinkDiscussionModal from '../LinkDiscussionModal';
import type FilePage from '../FilePage';
import type { DepotFile, DepotCardVersion } from '../../types';
import { when } from './shared';

function meta(file: DepotFile) {
  const v: Partial<DepotCardVersion> = file.version || {};
  return (
    <div className="DepotFileHero-meta">
      {UserChip({ user: file.user })}
      {v.version ? (
        <span>
          v{v.version} · {t('file.updated', { time: when(v.date) })}
        </span>
      ) : null}
      {file.ratings ? (
        <span className="DepotFileHero-rating">
          {/* A null rating (none yet) shows no number. */}
          {Stars({ value: file.rating as number })} {file.rating != null ? file.rating.toFixed(1) : null}{' '}
          <span className="Depot-dim">({number(file.ratings)})</span>
        </span>
      ) : null}
    </div>
  );
}

export function hero(page: FilePage, file: DepotFile) {
  return (
    <header className="DepotFileHero">
      {/* Clipped here, not on the header, so File controls can open past its edge. */}
      <div className="DepotFileHero-art">
        <div className={`DepotFileHero-backdrop ${file.cover ? '' : 'Depot-cover--empty'}`} style={coverStyle(file, 'thumb')} />
      </div>
      <div className="Page-container container DepotFileHero-inner">
        {Cover({ file, className: 'DepotFileHero-cover' })}
        <div className="DepotFileHero-text">
          <div className="DepotFileHero-labels">
            {CategoryLabels({ slug: file.category })}
            {SourceBadge({ file })}
            {PriceBadge({ file })}
            {file.featured ? (
              <span className="Depot-badge">
                <Icon name="fas fa-star" /> {t('file.featured')}
              </span>
            ) : null}
          </div>
          <h1 className="DepotFileHero-title">{file.title}</h1>
          {file.tagline ? <p className="DepotFileHero-tagline">{file.tagline}</p> : null}
          {meta(file)}
        </div>
        {file.canEdit || file.canModerate || file.canLinkDiscussion ? <div className="DepotFileHero-controls">{page.controls(file)}</div> : null}
      </div>
    </header>
  );
}

/** The editing half of the File controls menu. */
function editItems(page: FilePage, file: DepotFile) {
  const edit = (onsave: (slug: string) => unknown) => app.modal.show(EditFileModal, { file, onsave });
  return [
    file.canEdit ? (
      <Button icon="fas fa-plus" onclick={() => app.modal.show(VersionModal, { file, onsave: () => page.load() })}>
        {t('file.new_version')}
      </Button>
    ) : null,
    file.canEdit ? (
      <Button icon="fas fa-pen" onclick={() => edit((slug) => (slug !== file.slug ? m.route.set(app.route('depot.file', { slug })) : page.load()))}>
        {t('file.edit')}
      </Button>
    ) : null,
    file.canLinkDiscussion ? (
      <Button icon="far fa-comments" onclick={() => app.modal.show(LinkDiscussionModal, { file, onsave: () => page.load() })}>
        {file.discussion ? t('file.change_discussion') : t('file.link_discussion')}
      </Button>
    ) : null,
  ];
}

/** The moderating and selling half of the File controls menu, and Delete. */
function manageItems(page: FilePage, file: DepotFile) {
  return [
    file.canModerate ? (
      <Button icon={file.featured ? 'far fa-star' : 'fas fa-star'} onclick={() => page.act({ isFeatured: !file.featured })}>
        {file.featured ? t('file.unfeature') : t('file.feature')}
      </Button>
    ) : null,
    page.sellsOwn(file) ? (
      <Button icon="fas fa-cash-register" onclick={() => m.route.set(app.route('kiosk.selling', file.paid ? {} : { sell: 'depot-file:' + file.id }))}>
        {file.paid ? t('file.manage_listing') : t('file.sell_own')}
      </Button>
    ) : null,
    file.canSell ? (
      <Button icon={file.paid ? 'fas fa-lock-open' : 'fas fa-store'} onclick={() => page.act({ isPaid: !file.paid })}>
        {file.paid ? t('file.make_free') : t('file.sell')}
      </Button>
    ) : null,
    file.canEdit ? (
      <Button icon="far fa-trash-alt" onclick={() => page.remove(file)}>
        {t('file.delete')}
      </Button>
    ) : null,
  ];
}

export function controls(page: FilePage, file: DepotFile) {
  return (
    <Dropdown buttonClassName="Button" label={t('file.controls')} accessibleToggleLabel={t('file.controls')} menuClassName="Dropdown-menu--right">
      {/* One flat list: Dropdown wraps each child in its own <li>. */}
      {[...editItems(page, file), ...manageItems(page, file)]}
    </Dropdown>
  );
}

import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import humanTime from 'flarum/common/helpers/humanTime';
import type Mithril from 'mithril';
import { compact, number, daysAgo } from '../depot-api';
import { t, Sparkline, Stars, UserChip, CategoryLabels, SourceBadge, Cover, PriceBadge } from './bits';
import type { DepotCard, DepotCardVersion, DepotLockedTeaser } from '../types';

// humanTime is typed for a Date, but dayjs reads the API's ISO string just the same.
const when = (iso: string) => humanTime(iso as unknown as Date);

export type ViewMode = 'grid' | 'list';

export interface FileCardAttrs extends ComponentAttrs {
  file: DepotCard;
  mode: ViewMode;
}

/** What both layouts work out once, before drawing. */
interface CardFacts {
  v: Partial<DepotCardVersion>;
  product: boolean;
  fresh: boolean;
  href: string;
  pending: Mithril.Children;
}

/**
 * One file in a list, as a card (grid) or a row (list). The same facts in
 * both, in the same order: what it is, who made it, how current it is, and
 * how much people use and like it.
 */
export default class FileCard extends Component<FileCardAttrs> {
  view() {
    const { file, mode } = this.attrs;
    const v: Partial<DepotCardVersion> = file.version || {};
    const facts: CardFacts = {
      v,
      product: file.source === 'product',
      fresh: daysAgo(v.date) <= 7,
      href: app.route('depot.file', { slug: file.slug }),
      pending: !file.approved ? <span className="Depot-pill Depot-pill--warn">{t('card.pending')}</span> : null,
    };

    return mode === 'grid' ? this.card(file, facts) : this.row(file, facts);
  }

  card(file: DepotCard, { v, product, fresh, href, pending }: CardFacts) {
    return (
      <Link className="DepotCard" href={href}>
        {Cover({
          file,
          className: 'DepotCard-art',
          children: [
            v.version ? <span className="DepotCard-version">v{v.version}</span> : null,
            fresh ? <span className="DepotCard-fresh">{t('card.updated_badge')}</span> : null,
          ],
        })}
        <div className="DepotCard-body">
          <span className="DepotCard-labels">
            {CategoryLabels({ slug: file.category, link: false })}
            {PriceBadge({ file })}
            {pending}
          </span>
          <h3 className="DepotCard-title">{file.title}</h3>
          {file.tagline ? <p className="DepotCard-tagline">{file.tagline}</p> : null}
          <div className="DepotCard-meta">
            {UserChip({ user: file.user })}
            {v.date ? <span className="Depot-dim">{when(v.date)}</span> : null}
          </div>
        </div>
        {this.cardFoot(file, product)}
      </Link>
    );
  }

  cardFoot(file: DepotCard, isProduct: boolean) {
    return (
      <div className="DepotCard-foot">
        {/* A product counts licensed sites, with no daily trend, and no zero. */}
        {!isProduct || file.downloads > 0 ? (
          <span className="Depot-metric">
            <Icon name={isProduct ? 'fas fa-server' : 'fas fa-download'} /> <b>{compact(file.downloads)}</b>
          </span>
        ) : null}
        {!isProduct ? Sparkline({ values: file.trend, width: 64, height: 20 }) : null}
        <span className="Depot-metric Depot-metric--end">
          {file.ratings ? (
            // A null rating (none yet) shows no number.
            [Stars({ value: file.rating as number }), file.rating != null ? <b>{file.rating.toFixed(1)}</b> : null]
          ) : (
            <span className="Depot-dim">{t('card.no_ratings')}</span>
          )}
        </span>
      </div>
    );
  }

  row(file: DepotCard, { v, product, fresh, href, pending }: CardFacts) {
    return (
      <Link className="DepotRow" href={href}>
        {Cover({ file, className: 'DepotRow-thumb' })}
        <div className="DepotRow-main">
          <h3 className="DepotRow-title">
            {file.title} {v.version ? <span className="DepotRow-version">v{v.version}</span> : null}
            {fresh ? <span className="Depot-pill Depot-pill--fresh">{t('card.updated_badge')}</span> : null}
            {pending}
            {PriceBadge({ file })}
            {SourceBadge({ file })}
          </h3>
          {file.tagline ? <p className="DepotRow-tagline">{file.tagline}</p> : null}
          <div className="DepotRow-meta">
            {CategoryLabels({ slug: file.category, link: false })}
            {UserChip({ user: file.user })}
            {v.date ? (
              <span className="Depot-dim">
                {t('card.updated', { time: when(v.date) })}
                {file.compat.length ? ` · ${file.compat[0]}` : ''}
              </span>
            ) : null}
          </div>
        </div>
        <div className="DepotRow-trend">
          {!product ? [Sparkline({ values: file.trend, width: 88, height: 26 }), <span className="Depot-dim">{t('card.last_30_days')}</span>] : null}
        </div>
        {this.rowStats(file, product)}
      </Link>
    );
  }

  rowStats(file: DepotCard, isProduct: boolean) {
    return (
      <div className="DepotRow-stats">
        {!isProduct || file.downloads > 0 ? (
          <span className="DepotRow-downloads">
            <Icon name={isProduct ? 'fas fa-server' : 'fas fa-download'} /> {number(file.downloads)}
          </span>
        ) : null}
        {file.ratings ? (
          <span className="Depot-metric">
            {/* A null rating (none yet) shows no number. */}
            {Stars({ value: file.rating as number })} {file.rating != null ? <span className="Depot-dim">{file.rating.toFixed(1)}</span> : null}
          </span>
        ) : null}
      </div>
    );
  }
}

/**
 * A locked category, advertised: its name, how many files, and who it is for.
 * The server sends nothing else about what is inside.
 */
export function LockedCard({ locked, mode }: { locked: DepotLockedTeaser; mode: ViewMode }) {
  return (
    <div className={`DepotLocked DepotLocked--${mode}`} style={{ '--label-color': 'var(--muted-color)' }}>
      <div className="DepotLocked-text">
        <Icon name="fas fa-lock" />
        <b>{locked.name}</b>
        <span className="Depot-dim">{t('card.locked', { count: locked.count, group: locked.groups.join(', ') })}</span>
        <a className="Button Button--primary Button--small" href={app.route('depot.category', { slug: locked.slug })}>
          {t('card.see_category')}
        </a>
      </div>
    </div>
  );
}

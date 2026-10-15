import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import humanTime from 'flarum/common/helpers/humanTime';
import { artStyle } from '../art';
import { category, latest, compact, number, daysAgo } from '../data';
import { t, Sparkline, Stars, UserChip, CategoryLabels, SourceBadge } from './bits';

/**
 * One file in the browse list, as a card (grid) or a row (list).
 *
 * The same facts in both, in the same order: what it is, who made it, how
 * current it is, and how much people use and like it. The grid leads with the
 * picture; the list leads with the words.
 */
export default class FileCard extends Component {
  view() {
    const { file, mode } = this.attrs;
    if (file.locked) return this.locked(file, mode);

    const v = latest(file);
    const fresh = daysAgo(v.date) <= 7;
    const href = app.route('depot.file', { slug: file.slug });

    if (mode === 'grid') {
      return (
        <Link className="DepotCard" href={href}>
          <div className="DepotCard-art" style={artStyle(file.art)}>
            <span className="DepotCard-version">v{v.version}</span>
            {fresh ? <span className="DepotCard-fresh">{t('card.updated_badge')}</span> : null}
          </div>
          <div className="DepotCard-body">
            {CategoryLabels({ slug: file.category, link: false })}
            <h3 className="DepotCard-title">{file.title}</h3>
            <p className="DepotCard-tagline">{file.tagline}</p>
            <div className="DepotCard-meta">
              {UserChip({ user: file.user })}
              <span className="Depot-dim">{humanTime(v.date)}</span>
            </div>
          </div>
          <div className="DepotCard-foot">
            <span className="Depot-metric">
              <Icon name="fas fa-download" /> <b>{compact(file.downloads)}</b>
            </span>
            {Sparkline({ values: file.trend, width: 64, height: 20 })}
            <span className="Depot-metric Depot-metric--end">
              {Stars({ value: file.rating })} <b>{file.rating.toFixed(1)}</b>
            </span>
          </div>
        </Link>
      );
    }

    return (
      <Link className="DepotRow" href={href}>
        <div className="DepotRow-thumb" style={artStyle(file.art)} />
        <div className="DepotRow-main">
          <h3 className="DepotRow-title">
            {file.title} <span className="DepotRow-version">v{v.version}</span>
            {fresh ? <span className="Depot-pill Depot-pill--fresh">{t('card.updated_badge')}</span> : null}
            {SourceBadge({ file })}
          </h3>
          <p className="DepotRow-tagline">{file.tagline}</p>
          <div className="DepotRow-meta">
            {CategoryLabels({ slug: file.category, link: false })}
            {UserChip({ user: file.user })}
            <span className="Depot-dim">
              {t('card.updated', { time: humanTime(v.date) })} · {file.compat[file.compat.length - 1]}
            </span>
          </div>
        </div>
        <div className="DepotRow-trend">
          {Sparkline({ values: file.trend, width: 88, height: 26 })}
          <span className="Depot-dim">{t('card.last_30_days')}</span>
        </div>
        <div className="DepotRow-stats">
          <span className="DepotRow-downloads">
            <Icon name="fas fa-download" /> {number(file.downloads)}
          </span>
          <span className="Depot-metric">
            {Stars({ value: file.rating })} <span className="Depot-dim">{file.rating.toFixed(1)}</span>
          </span>
        </div>
      </Link>
    );
  }

  /**
   * A file this member cannot open, advertised instead of hidden.
   *
   * Built from the title, the count and the group only. The real extension
   * sends a different, smaller shape for these, so there is no picture URL or
   * description in the payload to leak.
   */
  locked(file, mode) {
    const c = category(file.category);
    const body = (
      <div className="DepotLocked-text">
        <Icon name="fas fa-lock" />
        <b>{file.title}</b>
        <span className="Depot-dim">{t('card.locked', { count: file.count, group: c.group })}</span>
        <a className="Button Button--primary Button--small" href="#" onclick={(e) => e.preventDefault()}>
          {t('card.get_access')}
        </a>
      </div>
    );

    return (
      <div className={`DepotLocked DepotLocked--${mode}`}>
        <div className="DepotLocked-art" style={artStyle(file.art)} />
        {body}
      </div>
    );
  }
}

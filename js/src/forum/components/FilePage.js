import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import Button from 'flarum/common/components/Button';
import SplitDropdown from 'flarum/common/components/SplitDropdown';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import humanTime from 'flarum/common/helpers/humanTime';
import { artStyle } from '../art';
import { fileBySlug, hydrate, latest, users, bytes, number, compact, files, category } from '../data';
import { t, Sparkline, Stars, Avatar, UserChip, CategoryLabels, SourceBadge } from './bits';
import DownloadModal from './DownloadModal';
import LightboxModal from './LightboxModal';

const shortDate = (d) => dayjs(d).format('ll');
const TABS = ['overview', 'versions', 'reviews', 'discussion'];
const KINDS = [
  ['added', 'fas fa-plus'],
  ['changed', 'fas fa-pen'],
  ['fixed', 'fas fa-wrench'],
];

/**
 * One file.
 *
 * Laid out like a discussion — hero across the top, content on the left, a
 * sidebar on the right — so it reads as part of the forum. The sidebar holds
 * everything needed to decide and download without scrolling: the button,
 * how current it is, how many people use it, and the checksum.
 */
export default class FilePage extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    this.tab = TABS.includes(m.route.param('tab')) ? m.route.param('tab') : 'overview';
    this.watching = false;
    this.helpful = {};
    this.starFilter = 0;
    this.open = { 0: true };
  }

  view() {
    const file = fileBySlug(m.route.param('slug'));
    if (!file || file.locked) return <PageStructure className="DepotFilePage">{this.missing()}</PageStructure>;
    hydrate(file);
    app.setTitle(file.title);
    app.setTitleCount(0);

    return (
      <PageStructure className="DepotFilePage" hero={() => this.hero(file)}>
        <div className="DepotFile">
          <div className="DepotFile-main">
            <nav className="DepotTabs" role="tablist">
              {TABS.map((tab) => (
                <button type="button" role="tab" aria-selected={this.tab === tab ? 'true' : 'false'} className={this.tab === tab ? 'is-active' : ''} onclick={() => (this.tab = tab)}>
                  {t(`file.tab_${tab}`)}
                  {this.tabCount(file, tab)}
                </button>
              ))}
            </nav>
            <div className="DepotFile-panel" role="tabpanel">
              {this[this.tab](file)}
            </div>
          </div>
          <aside className="DepotFile-side">{this.side(file)}</aside>
        </div>
      </PageStructure>
    );
  }

  tabCount(file, tab) {
    const n = { versions: file.versions.length, reviews: file.ratings, discussion: file.discussionReplies }[tab];
    return n ? <span className="DepotTabs-count">{compact(n)}</span> : null;
  }

  missing() {
    return (
      <div className="container DepotEmpty">
        <Icon name="fas fa-box-open" />
        <h3>{t('file.missing_title')}</h3>
        <a className="Button" href={app.route('depot.index')}>
          {t('file.missing_back')}
        </a>
      </div>
    );
  }

  hero(file) {
    const v = latest(file);
    return (
      <header className="DepotFileHero">
        <div className="DepotFileHero-backdrop" style={artStyle(file.art)} />
        <div className="Page-container container DepotFileHero-inner">
          <div className="DepotFileHero-cover" style={artStyle(file.art)} />
          <div className="DepotFileHero-text">
            <div className="DepotFileHero-labels">
              {CategoryLabels({ slug: file.category })}
              {SourceBadge({ file })}
            </div>
            <h1 className="DepotFileHero-title">{file.title}</h1>
            <p className="DepotFileHero-tagline">{file.tagline}</p>
            <div className="DepotFileHero-meta">
              {UserChip({ user: file.user })}
              <span>
                v{v.version} · {t('file.updated', { time: humanTime(v.date) })}
              </span>
              <span className="DepotFileHero-rating">
                {Stars({ value: file.rating })} {file.rating.toFixed(1)} <span className="Depot-dim">({number(file.ratings)})</span>
              </span>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // ---------------------------------------------------------------- overview

  overview(file) {
    const v = latest(file);
    return (
      <div className="DepotOverview">
        <div className={`DepotGallery DepotGallery--${Math.min(file.shots.length, 5)}`}>
          {file.shots.slice(0, 5).map((shot, i) => (
            <button type="button" className="DepotGallery-item" style={artStyle(shot)} aria-label={t('file.screenshot', { n: i + 1 })} onclick={() => app.modal.show(LightboxModal, { shots: file.shots, index: i, title: file.title })}>
              {i === 4 && file.shots.length > 5 ? <span>+{file.shots.length - 5}</span> : null}
            </button>
          ))}
        </div>

        <div className="DepotProse">
          {file.description.map((p) => (
            <p>{p}</p>
          ))}
        </div>

        <section className="DepotFacts">
          <h3>{t('file.at_a_glance')}</h3>
          <dl>
            <dt>{t('file.works_with')}</dt>
            <dd>
              <span className="Depot-dim">{file.game}</span>
              <span className="DepotFacts-chips">
                {file.compat.map((c, i) => (
                  <span className={`Depot-chip Depot-chip--static ${i === file.compat.length - 1 ? 'is-active' : ''}`}>{c}</span>
                ))}
              </span>
            </dd>
            {file.fields.map(([k, val]) => [<dt>{k}</dt>, <dd>{val}</dd>])}
            <dt>{t('file.licence')}</dt>
            <dd>{file.licence}</dd>
          </dl>
        </section>

        {file.requires.length ? (
          <section className="DepotRequires">
            <h3>{t('file.requires')}</h3>
            {file.requires.map((r) => (
              <div className="DepotRequires-item">
                <Icon name={r.optional ? 'fas fa-puzzle-piece' : 'fas fa-link'} />
                <div>
                  <b>{r.name}</b>
                  <span className="Depot-dim">{r.note}</span>
                </div>
                <span className={`Depot-pill ${r.optional ? '' : 'Depot-pill--warn'}`}>{r.optional ? t('file.optional') : t('file.required')}</span>
              </div>
            ))}
          </section>
        ) : null}

        {file.install.length ? (
          <section className="DepotInstall">
            <h3>{t('file.install')}</h3>
            <ol className="Depot-steps">
              {file.install.map((s) => (
                <li>{s}</li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="DepotLatest">
          <div className="DepotLatest-head">
            <h3>{t('file.whats_new', { version: v.version })}</h3>
            <button type="button" className="Button Button--link" onclick={() => (this.tab = 'versions')}>
              {t('file.all_versions')} <Icon name="fas fa-arrow-right" />
            </button>
          </div>
          {this.changes(v)}
        </section>

        {this.more(file)}
      </div>
    );
  }

  more(file) {
    const others = files.filter((f) => f !== file && !f.locked && (f.user === file.user || category(f.category).parent === category(file.category).parent)).slice(0, 3);
    if (!others.length) return null;
    return (
      <section className="DepotMore">
        <h3>{t('file.more_like_this')}</h3>
        <div className="DepotMore-grid">
          {others.map((f) => (
            <a className="DepotMore-item" href={app.route('depot.file', { slug: f.slug })}>
              <span className="DepotMore-art" style={artStyle(f.art)} />
              <span>
                <b>{f.title}</b>
                <span className="Depot-dim">
                  <Icon name="fas fa-download" /> {compact(f.downloads)} · {f.rating.toFixed(1)} <Icon name="fas fa-star" />
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>
    );
  }

  changes(v) {
    return (
      <div className="DepotChanges">
        {KINDS.filter(([k]) => v.changes[k]).map(([k, icon]) => (
          <div className={`DepotChanges-group DepotChanges-group--${k}`}>
            <span className="DepotChanges-kind">
              <Icon name={icon} /> {t(`file.change_${k}`)}
            </span>
            <ul>
              {v.changes[k].map((c) => (
                <li>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  // ---------------------------------------------------------------- versions

  versions(file) {
    return (
      <ol className="DepotTimeline">
        {file.versions.map((v, i) => (
          <li className={`DepotTimeline-item ${i === 0 ? 'is-latest' : ''} ${this.open[i] ? 'is-open' : ''}`}>
            <span className="DepotTimeline-dot" />
            <div className="DepotTimeline-card">
              <button type="button" className="DepotTimeline-head" aria-expanded={this.open[i] ? 'true' : 'false'} onclick={() => (this.open[i] = !this.open[i])}>
                <span className="DepotTimeline-version">v{v.version}</span>
                {i === 0 ? <span className="Depot-pill Depot-pill--fresh">{t('file.latest')}</span> : null}
                <span className="Depot-dim">
                  {shortDate(v.date)} · {bytes(v.size) || t('file.external')} · {t('file.version_downloads', { count: number(v.downloads) })}
                </span>
                <Icon name={this.open[i] ? 'fas fa-chevron-up' : 'fas fa-chevron-down'} className="DepotTimeline-caret" />
              </button>
              {this.open[i] ? (
                <div className="DepotTimeline-body">
                  {this.changes(v)}
                  <div className="DepotTimeline-foot">
                    <code className="DepotTimeline-sha" title="SHA-256">
                      <Icon name="fas fa-shield-alt" /> {v.sha256.slice(0, 16)}…
                    </code>
                    <Button className={`Button ${i === 0 ? 'Button--primary' : ''}`} icon="fas fa-download" onclick={() => app.modal.show(DownloadModal, { file, version: v })}>
                      {t('file.download_version', { version: v.version })}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  // ---------------------------------------------------------------- reviews

  reviews(file) {
    const total = file.distribution.reduce((a, b) => a + b, 0) || 1;
    const shown = file.reviews.filter((r) => !this.starFilter || r.stars === this.starFilter);
    return (
      <div className="DepotReviews">
        <div className="DepotReviews-summary">
          <div className="DepotReviews-score">
            <b>{file.rating.toFixed(1)}</b>
            {Stars({ value: file.rating, size: 'Depot-stars--large' })}
            <span className="Depot-dim">{t('file.ratings', { count: number(file.ratings) })}</span>
          </div>
          <div className="DepotReviews-bars">
            {file.distribution.map((n, i) => {
              const star = 5 - i;
              return (
                <button type="button" className={`DepotReviews-bar ${this.starFilter === star ? 'is-active' : ''}`} onclick={() => (this.starFilter = this.starFilter === star ? 0 : star)} aria-pressed={this.starFilter === star ? 'true' : 'false'}>
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
          <Button className="Button Button--primary" icon="far fa-star">
            {t('file.write_review')}
          </Button>
        </div>

        {shown.length ? (
          shown.map((r) => {
            const key = r.user + r.date;
            return (
              <article className="DepotReview">
                {Avatar({ user: r.user })}
                <div className="DepotReview-body">
                  <header>
                    <b>{users[r.user].username}</b>
                    {Stars({ value: r.stars })}
                    <span className="Depot-dim">
                      {humanTime(r.date)} · {t('file.reviewed_version', { version: r.version })}
                    </span>
                  </header>
                  <p>{r.body}</p>
                  {r.reply ? (
                    <div className="DepotReview-reply">
                      {Avatar({ user: file.user, className: 'Avatar--mini' })}
                      <div>
                        <b>{users[file.user].username}</b> <span className="Depot-pill">{t('file.author')}</span>
                        <p>{r.reply}</p>
                      </div>
                    </div>
                  ) : null}
                  <button type="button" className={`DepotReview-helpful ${this.helpful[key] ? 'is-active' : ''}`} aria-pressed={this.helpful[key] ? 'true' : 'false'} onclick={() => (this.helpful[key] = !this.helpful[key])}>
                    <Icon name={this.helpful[key] ? 'fas fa-thumbs-up' : 'far fa-thumbs-up'} /> {t('file.helpful', { count: r.helpful + (this.helpful[key] ? 1 : 0) })}
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <p className="Depot-dim DepotReviews-none">{t('file.no_reviews')}</p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- discussion

  discussion(file) {
    const tag = this.supportTag();
    return (
      <div className="DepotDiscussion">
        <div className="DepotThread">
          <Icon name="far fa-comments" />
          <div>
            <b>{t('file.thread_title', { title: file.title })}</b>
            <span className="Depot-dim">
              {t('file.thread_meta', { count: file.discussionReplies })}
              {tag ? (
                <>
                  {' · '}
                  <span className="Depot-label" style={{ '--label-color': tag.color }}>
                    {tag.name}
                  </span>
                </>
              ) : null}
            </span>
          </div>
          <a className="Button" href="#" onclick={(e) => e.preventDefault()}>
            {t('file.thread_open')}
          </a>
        </div>
        {file.posts.map((p) => (
          <article className="Post CommentPost DepotPost">
            <header className="Post-header">
              <ul>
                <li className="item-user">
                  <div className="PostUser">
                    <h3 className="PostUser-name">
                      {Avatar({ user: p.user, className: 'PostUser-avatar' })}
                      <span className="username">{users[p.user].username}</span>
                    </h3>
                  </div>
                </li>
                <li className="item-meta">
                  <span className="Depot-dim">{humanTime(p.date)}</span>
                </li>
                {p.user === file.user ? (
                  <li>
                    <span className="Depot-pill">{t('file.author')}</span>
                  </li>
                ) : null}
              </ul>
            </header>
            <div className="Post-body">
              <p>{p.body}</p>
            </div>
          </article>
        ))}
        <div className="DepotReply">
          <span className="Avatar Avatar--mini" style={{ '--avatar-bg': app.session.user ? app.session.user.color() : '#8a99ad' }}>
            {app.session.user ? app.session.user.displayName().charAt(0).toUpperCase() : '?'}
          </span>
          <span>{t('file.reply_placeholder')}</span>
        </div>
      </div>
    );
  }

  /** The tag the support discussion was filed under — a real forum tag when flarum/tags has one called Support. */
  supportTag() {
    const tags = app.store.all('tags') || [];
    const tag = tags.find((x) => /support|help/i.test(x.name())) || tags.find((x) => x.isPrimary && x.isPrimary());
    return tag ? { name: tag.name(), color: tag.color() || 'var(--control-color)' } : null;
  }

  // ---------------------------------------------------------------- sidebar

  side(file) {
    const v = latest(file);
    const total30 = file.trend.reduce((a, b) => a + b, 0);
    const u = users[file.user];
    const dl = () => app.modal.show(DownloadModal, { file, version: v });

    return [
      <div className="DepotSideCard DepotSideCard--download">
        <SplitDropdown className="DepotDownloadSplit" buttonClassName="Button Button--primary Button--large" icon="fas fa-download" accessibleToggleLabel={t('file.older_versions')}>
          <Button icon="fas fa-download" onclick={dl}>
            {t('file.download', { version: v.version })}
          </Button>
          {file.versions.slice(1).map((old) => (
            <Button icon="fas fa-history" onclick={() => app.modal.show(DownloadModal, { file, version: old })}>
              {t('file.download_old', { version: old.version, time: humanTime(old.date) })}
            </Button>
          ))}
        </SplitDropdown>
        <div className="DepotSideCard-sub">
          {file.format}
          {v.size ? ` · ${bytes(v.size)}` : ''} · {t('file.released', { time: humanTime(v.date) })}
        </div>
        <Button className={`Button DepotWatch ${this.watching ? 'is-active' : ''}`} icon={this.watching ? 'fas fa-bell' : 'far fa-bell'} onclick={() => (this.watching = !this.watching)}>
          {this.watching ? t('file.watching') : t('file.watch')}
        </Button>
        <div className="DepotSideCard-trust">
          <Tooltip text={t('file.verified_tooltip')}>
            <span>
              <Icon name="fas fa-shield-alt" /> {t('file.verified')}
            </span>
          </Tooltip>
          <span>
            <Icon name="far fa-eye" /> {t('file.watchers', { count: number(file.watchers + (this.watching ? 1 : 0)) })}
          </span>
        </div>
      </div>,

      <div className="DepotSideCard">
        <div className="DepotSideCard-row">
          <div>
            <b className="DepotSideCard-big">{number(file.downloads)}</b>
            <span className="Depot-dim">{t('file.total_downloads')}</span>
          </div>
          <div className="DepotSideCard-trend">
            {Sparkline({ values: file.trend, width: 120, height: 36 })}
            <span className="Depot-dim">{t('file.last_30', { count: number(total30) })}</span>
          </div>
        </div>
        <dl className="DepotStats">
          <dt>{t('file.this_version')}</dt>
          <dd>{number(v.downloads)}</dd>
          <dt>{t('file.first_released')}</dt>
          <dd>{shortDate(file.created)}</dd>
          <dt>{t('file.versions')}</dt>
          <dd>{file.versions.length}</dd>
        </dl>
      </div>,

      file.source !== 'link' ? (
        <div className="DepotSideCard">
          <h4 className="DepotSideCard-label">SHA-256</h4>
          <div className="Depot-copy Depot-copy--small">
            <code>{v.sha256}</code>
            <Button className="Button Button--icon" icon={this.copied ? 'fas fa-check' : 'far fa-copy'} aria-label={t('download.copy')} onclick={() => this.copy(v.sha256)} />
          </div>
        </div>
      ) : null,

      file.source === 'github' ? (
        <div className="DepotSideCard DepotSideCard--source">
          <Icon name="fab fa-github" />
          <div>
            <b>{file.repo}</b>
            <span className="Depot-dim">{t('file.github_sync', { time: humanTime(v.date) })}</span>
          </div>
        </div>
      ) : null,

      <div className="DepotSideCard DepotSideCard--author">
        {Avatar({ user: file.user, className: 'Avatar--large' })}
        <div>
          <b>{u.username}</b>
          <span className="Depot-dim">{t('file.author_stats', { files: u.files, downloads: compact(u.downloads) })}</span>
        </div>
        <Button className="Button Button--small">{t('file.more_by')}</Button>
      </div>,

      <details className="DepotSideCard DepotApi">
        <summary>
          <Icon name="fas fa-code" /> {t('file.api')}
        </summary>
        <p className="Depot-dim">{t('file.api_help')}</p>
        <pre>{`GET /api/depot/files/${file.slug}/latest

{
  "version": "${v.version}",
  "sha256": "${v.sha256.slice(0, 12)}…",
  "size": ${v.size},
  "url": "/downloads/f/${file.slug}/${v.version}"
}`}</pre>
      </details>,
    ];
  }

  copy(text) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copied = true;
      m.redraw();
      setTimeout(() => ((this.copied = false), m.redraw()), 1800);
    }, () => {});
  }
}

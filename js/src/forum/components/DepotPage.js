import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import Button from 'flarum/common/components/Button';
import SelectDropdown from 'flarum/common/components/SelectDropdown';
import Icon from 'flarum/common/components/Icon';
import extractText from 'flarum/common/utils/extractText';
import { artStyle } from '../art';
import { categories, category, rootOf, childrenOf, files, inCategory, latest, pending, compact } from '../data';
import { t } from './bits';
import FileCard from './FileCard';
import Spotlight from './Spotlight';
import DepotSidebar from './DepotSidebar';

const SORTS = {
  updated: (a, b) => latest(b).date - latest(a).date,
  downloads: (a, b) => b.downloads - a.downloads,
  rating: (a, b) => b.rating - a.rating,
  newest: (a, b) => b.created - a.created,
};

function stored(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Browse: every file, or one category's.
 *
 * Built on Flarum's own PageStructure and IndexPage sidebar markup, so the
 * mobile drop-down, the sticky sidebar and the page spacing all come from core
 * and match the discussion list exactly.
 */
export default class DepotPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    this.bodyClass = 'App--index';
    this.sort = 'updated';
    this.mode = stored('depot.view', 'grid');
    this.compat = null;
    this.query = '';
  }

  slug() {
    return m.route.param('slug') || null;
  }

  view() {
    const slug = this.slug();
    const c = slug && category(slug);
    app.setTitle(c ? c.name : extractText(t('title')));
    app.setTitleCount(0);

    return (
      <PageStructure className="IndexPage DepotPage" hero={() => this.hero(c)} sidebar={() => this.sidebar()}>
        {this.content(c)}
      </PageStructure>
    );
  }

  hero(c) {
    if (!c) return <Spotlight files={files.filter((f) => f.featured)} />;

    const root = rootOf(c);
    const count = files.filter((f) => !f.locked && inCategory(f, c.slug)).length;
    return (
      <header className="DepotHero" style={{ '--hero-tint': root.color }}>
        <div className="DepotHero-art" style={artStyle(root.art)} />
        <div className="Page-container container DepotHero-inner">
          {c.parent ? (
            <a className="DepotHero-up" href={app.route('depot.category', { slug: root.slug })}>
              <Icon name="fas fa-chevron-left" /> {root.name}
            </a>
          ) : null}
          <h1 className="DepotHero-title">
            {root.icon && !c.parent ? <Icon name={root.icon} /> : null} {c.name}
          </h1>
          <p className="DepotHero-desc">{c.description || root.description}</p>
          <span className="DepotHero-count">{t('hero.count', { count })}</span>
        </div>
      </header>
    );
  }

  sidebar() {
    return <DepotSidebar />;
  }

  visible(c) {
    const q = this.query.trim().toLowerCase();
    return files
      .filter((f) => (c ? (c.locked ? f.locked : inCategory(f, c.slug)) : true))
      .filter((f) => f.locked || !this.compat || f.compat.includes(this.compat))
      .filter((f) => !q || (!f.locked && (f.title + ' ' + f.tagline).toLowerCase().includes(q)))
      .sort((a, b) => (a.locked - b.locked) || (a.locked ? 0 : SORTS[this.sort](a, b)));
  }

  content(c) {
    const list = this.visible(c);
    const real = list.filter((f) => !f.locked);
    const versions = [...new Set(files.filter((f) => !f.locked && (!c || inCategory(f, c.slug))).flatMap((f) => f.compat))].slice(-6).reverse();

    return (
      <div className="IndexPage-results sideNavOffset DepotPage-results">
        {app.session.user && app.session.user.isAdmin() && pending ? (
          <div className="DepotNotice">
            <Icon name="fas fa-hourglass-half" />
            <span>{t('notice.pending', { count: pending })}</span>
            <Button className="Button Button--small">{t('notice.review')}</Button>
          </div>
        ) : null}

        {!c ? this.categoryTiles() : this.subnav(c)}

        <div className="DepotToolbar">
          <SelectDropdown buttonClassName="Button" className="DepotToolbar-sort" accessibleToggleLabel={t('toolbar.sort')}>
            {Object.keys(SORTS).map((key) => (
              <Button icon={this.sort === key ? 'fas fa-check' : true} active={this.sort === key} onclick={() => (this.sort = key)}>
                {t(`toolbar.sort_${key}`)}
              </Button>
            ))}
          </SelectDropdown>

          {c ? (
          <div className="DepotToolbar-chips" role="group" aria-label={t('toolbar.compat')}>
            {versions.map((v) => (
              <button type="button" className={`Depot-chip ${this.compat === v ? 'is-active' : ''}`} aria-pressed={this.compat === v ? 'true' : 'false'} onclick={() => (this.compat = this.compat === v ? null : v)}>
                {v}
              </button>
            ))}
          </div>
          ) : null}

          <div className="DepotToolbar-search">
            <Icon name="fas fa-search" />
            <input className="FormControl" type="search" placeholder={extractText(t('toolbar.search'))} value={this.query} oninput={(e) => (this.query = e.target.value)} aria-label={extractText(t('toolbar.search'))} />
          </div>

          <div className="DepotToolbar-view" role="group" aria-label={t('toolbar.view')}>
            {['grid', 'list'].map((mode) => (
              <Button
                className={`Button Button--icon ${this.mode === mode ? 'active' : ''}`}
                icon={mode === 'grid' ? 'fas fa-th-large' : 'fas fa-list'}
                aria-label={t(`toolbar.view_${mode}`)}
                aria-pressed={this.mode === mode ? 'true' : 'false'}
                onclick={() => this.setMode(mode)}
              />
            ))}
          </div>
        </div>

        <div className="DepotToolbar-summary Depot-dim">
          {t('toolbar.showing', { count: real.length })}
          {this.compat ? (
            <button type="button" className="Depot-clear" onclick={() => (this.compat = null)}>
              {t('toolbar.clear_filter', { version: this.compat })} <Icon name="fas fa-times" />
            </button>
          ) : null}
        </div>

        {list.length ? (
          <div className={this.mode === 'grid' ? 'DepotGrid' : 'DepotList'}>
            {list.map((file) => (
              <FileCard file={file} mode={this.mode} key={file.slug} />
            ))}
          </div>
        ) : (
          <div className="DepotEmpty">
            <Icon name="fas fa-box-open" />
            <h3>{t('empty.title')}</h3>
            <p>{t('empty.body')}</p>
            <Button className="Button" onclick={() => ((this.query = ''), (this.compat = null))}>
              {t('empty.reset')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  categoryTiles() {
    return (
      <div className="DepotTiles">
        {categories
          .filter((c) => !c.parent)
          .map((c) => {
            const inside = files.filter((f) => f.category === c.slug || category(f.category).parent === c.slug);
            const count = c.locked ? inside.reduce((n, f) => n + (f.count || 0), 0) : inside.length;
            const downloads = inside.reduce((n, f) => n + (f.downloads || 0), 0);
            return (
              <a className={`DepotTile ${c.locked ? 'DepotTile--locked' : ''}`} href={app.route('depot.category', { slug: c.slug })} style={{ '--label-color': c.color }}>
                <span className="DepotTile-art" style={artStyle(c.art)} />
                <span className="DepotTile-icon">
                  <Icon name={c.icon} />
                </span>
                <span className="DepotTile-name">{c.name}</span>
                <span className="DepotTile-count">{c.locked ? t('tiles.locked', { group: c.group }) : t('tiles.count', { count, downloads: compact(downloads) })}</span>
              </a>
            );
          })}
      </div>
    );
  }

  /** A category's subcategories, as chips above its files — one tap down, one tap back. */
  subnav(c) {
    const root = rootOf(c);
    const subs = childrenOf(root.slug);
    if (!subs.length) return null;
    const chip = (cat, label) => (
      <a className={`Depot-chip ${cat.slug === c.slug ? 'is-active' : ''}`} href={app.route('depot.category', { slug: cat.slug })}>
        {label || cat.name}
      </a>
    );
    return (
      <nav className="DepotSubnav" aria-label={t('nav.subcategories')}>
        {chip(root, t('nav.everything_in', { name: root.name }))}
        {subs.map((sub) => chip(sub))}
      </nav>
    );
  }

  setMode(mode) {
    this.mode = mode;
    try {
      localStorage.setItem('depot.view', mode);
    } catch (e) {
      // Private windows refuse storage; the choice simply is not remembered.
    }
  }
}

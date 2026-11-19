import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import Button from 'flarum/common/components/Button';
import SelectDropdown from 'flarum/common/components/SelectDropdown';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import extractText from 'flarum/common/utils/extractText';
import type { IPageAttrs } from 'flarum/common/components/Page';
import type Mithril from 'mithril';
import { api, state, category, rootOf, childrenOf, roots } from '../depot-api';
import { t, coverStyle } from './bits';
import FileCard, { LockedCard } from './FileCard';
import type { ViewMode } from './FileCard';
import Spotlight from './Spotlight';
import DepotSidebar from './DepotSidebar';
import type { DepotBrowse, DepotCard, DepotCategory } from '../types';

const SORTS = ['updated', 'downloads', 'rating', 'newest'];

function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (e) {
    // Private windows refuse storage: fall back to the default.
    return fallback;
  }
}

/** What a toolbar control changes before the list reloads. */
type Changes = Partial<Pick<DepotPage, 'sort' | 'compat' | 'query'>>;

/**
 * Browse: every file, one category's, or one of the member's own views
 * (watching, my files, the approval queue).
 *
 * Flarum's PageStructure and a subclass of core's IndexSidebar, so the
 * mobile drop-down, the sidebar and the spacing are core's own and every
 * theme that styles the discussion list styles this too.
 */
export default class DepotPage extends Page {
  sort!: string;
  mode!: ViewMode;
  compat!: string;
  query!: string;
  data!: DepotBrowse | null;
  files!: DepotCard[];
  loading!: boolean;
  request?: Promise<DepotBrowse>;
  debounce?: ReturnType<typeof setTimeout>;

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);
    this.bodyClass = 'App--index';
    this.sort = 'updated';
    // Anything else stored draws as a list, as the layout only checks for 'grid'.
    this.mode = stored('depot.view', 'grid') as ViewMode;
    this.compat = '';
    this.query = '';
    this.data = null;
    this.files = [];
    this.loading = true;
    this.load();
  }

  onremove(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.onremove(vnode);
    clearTimeout(this.debounce);
  }

  slug() {
    return m.route.param('slug') || '';
  }

  filter() {
    return m.route.param('filter') || '';
  }

  load(page = 0) {
    this.loading = true;
    const params = { category: this.slug(), sort: this.sort, q: this.query, compat: this.compat, filter: this.filter(), page };
    const ask = (this.request = api.get<DepotBrowse>('browse', params));

    return ask.then(
      (data) => {
        // A slower, older answer must not overwrite a newer one.
        if (ask !== this.request) return;
        state.categories = data.categories;
        this.files = page ? [...this.files, ...data.files] : data.files;
        this.data = data;
        this.loading = false;
        m.redraw();
      },
      () => {
        this.loading = false;
        m.redraw();
      }
    );
  }

  view() {
    const c = category(this.slug());
    const filter = this.filter();
    app.setTitle(c ? c.name : filter ? extractText(t(`nav.${filter}`)) : extractText(t('title')));
    app.setTitleCount(0);

    return (
      <PageStructure className="IndexPage DepotPage" hero={() => this.hero(c)} sidebar={() => <DepotSidebar />}>
        {this.content(c)}
      </PageStructure>
    );
  }

  hero(c: DepotCategory | undefined) {
    if (!this.data) return null;

    if (!c) {
      const featured = this.data.featured || [];
      return featured.length && !this.filter() ? <Spotlight files={featured} /> : this.plainHero();
    }

    // A category the server sent always has its parent beside it.
    const root = rootOf(c)!;
    const count = c.parent ? c.count : childrenOf(c.slug).reduce((n, s) => n + s.count, c.count);
    return (
      <header className="DepotHero" style={{ '--hero-tint': root.color || 'var(--primary-color)' }}>
        <div className="Page-container container DepotHero-inner">
          {c.parent ? (
            <a className="DepotHero-up" href={app.route('depot.category', { slug: root.slug })}>
              <Icon name="fas fa-chevron-left" /> {root.name}
            </a>
          ) : null}
          <h1 className="DepotHero-title">
            {root.icon && !c.parent ? <Icon name={root.icon} /> : null} {c.name}
          </h1>
          {c.description || root.description ? <p className="DepotHero-desc">{c.description || root.description}</p> : null}
          <span className="DepotHero-count">{t('hero.count', { count })}</span>
        </div>
      </header>
    );
  }

  plainHero() {
    const filter = this.filter();
    return (
      <header className="DepotHero" style={{ '--hero-tint': 'var(--primary-color)' }}>
        <div className="Page-container container DepotHero-inner">
          <h1 className="DepotHero-title">
            <Icon name="fas fa-box-open" /> {filter ? t(`nav.${filter}`) : t('title')}
          </h1>
          <p className="DepotHero-desc">{t(`hero.${filter || 'all'}_desc`)}</p>
        </div>
      </header>
    );
  }

  content(c: DepotCategory | undefined) {
    if (!this.data) return <LoadingIndicator display="block" />;
    const d = this.data;
    const filter = this.filter();

    return (
      <div className="IndexPage-results sideNavOffset DepotPage-results">
        {d.pending && filter !== 'queue' ? this.pendingNotice(d.pending) : null}

        {!c && !filter ? this.categoryTiles() : c ? this.subnav(c) : null}

        {this.toolbar(d)}

        <div className="DepotToolbar-summary Depot-dim">
          {t('toolbar.showing', { count: this.files.length })}
          {this.compat ? (
            <button type="button" className="Depot-clear" onclick={() => this.set({ compat: '' })}>
              {t('toolbar.clear_filter', { version: this.compat })} <Icon name="fas fa-times" />
            </button>
          ) : null}
        </div>

        {this.results(d)}

        {d.hasMore ? (
          <div className="DepotMoreButton">
            <Button className="Button" loading={this.loading} onclick={() => this.load(d.page + 1)}>
              {t('toolbar.load_more')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  pendingNotice(count: number) {
    return (
      <div className="DepotNotice">
        <Icon name="fas fa-hourglass-half" />
        <span>{t('notice.pending', { count })}</span>
        <a className="Button Button--small" href={app.route('depot.index', { filter: 'queue' })}>
          {t('notice.review')}
        </a>
      </div>
    );
  }

  toolbar(d: DepotBrowse) {
    return (
      <div className="DepotToolbar">
        <SelectDropdown buttonClassName="Button" className="DepotToolbar-sort" accessibleToggleLabel={t('toolbar.sort')}>
          {SORTS.map((key) => (
            <Button icon={this.sort === key ? 'fas fa-check' : true} active={this.sort === key} onclick={() => this.set({ sort: key })}>
              {t(`toolbar.sort_${key}`)}
            </Button>
          ))}
        </SelectDropdown>

        {d.compat.length ? this.compatChips(d.compat) : null}

        {this.search()}

        <div className="DepotToolbar-view" role="group" aria-label={t('toolbar.view')}>
          {(['grid', 'list'] as const).map((mode) => (
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
    );
  }

  compatChips(versions: string[]) {
    return (
      <div className="DepotToolbar-chips" role="group" aria-label={t('toolbar.compat')}>
        {versions.map((v) => (
          <button
            type="button"
            className={`Depot-chip ${this.compat === v ? 'is-active' : ''}`}
            aria-pressed={this.compat === v ? 'true' : 'false'}
            onclick={() => this.set({ compat: this.compat === v ? '' : v })}
          >
            {v}
          </button>
        ))}
      </div>
    );
  }

  search() {
    return (
      <div className="DepotToolbar-search">
        <Icon name="fas fa-search" />
        <input
          className="FormControl"
          type="search"
          placeholder={extractText(t('toolbar.search'))}
          aria-label={extractText(t('toolbar.search'))}
          value={this.query}
          oninput={(e: InputEvent) => {
            this.query = (e.target as HTMLInputElement).value;
            clearTimeout(this.debounce);
            this.debounce = setTimeout(() => this.load(), 300);
          }}
        />
      </div>
    );
  }

  results(d: DepotBrowse) {
    if (this.files.length || d.locked.length) {
      return (
        <div className={this.mode === 'grid' ? 'DepotGrid' : 'DepotList'}>
          {this.files.map((file) => (
            <FileCard file={file} mode={this.mode} key={file.id} />
          ))}
          {d.locked.map((locked) => LockedCard({ locked, mode: this.mode }))}
        </div>
      );
    }

    return this.loading ? <LoadingIndicator display="block" /> : this.empty();
  }

  empty() {
    const filtered = this.query || this.compat;
    const filter = this.filter();
    return (
      <div className="DepotEmpty">
        <Icon name="fas fa-box-open" />
        <h3>{t(filtered ? 'empty.title' : 'empty.none_title')}</h3>
        <p>{t(filtered ? 'empty.body' : filter ? `empty.${filter}` : 'empty.none_body')}</p>
        {filtered ? (
          <Button className="Button" onclick={() => ((this.query = ''), this.set({ compat: '' }))}>
            {t('empty.reset')}
          </Button>
        ) : null}
      </div>
    );
  }

  set(changes: Changes) {
    Object.assign(this, changes);
    this.load();
  }

  /** Subcategories as chips above the files — one tap down, one tap back. */
  subnav(c: DepotCategory) {
    // A category the server sent always has its parent beside it.
    const root = rootOf(c)!;
    // Only the ones this person may open: a closed one would just be an empty list.
    const subs = childrenOf(root.slug).filter((sub) => sub.open);
    if (!subs.length) return null;
    const chip = (cat: DepotCategory, label?: Mithril.Children) => (
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

  categoryTiles() {
    const list = roots();
    if (!list.length) return null;
    return (
      <div className="DepotTiles">
        {list.map((c) => {
          const count = childrenOf(c.slug).reduce((n, s) => n + s.count, c.count);
          return (
            <a
              className={`DepotTile ${c.open ? '' : 'DepotTile--locked'}`}
              href={app.route('depot.category', { slug: c.slug })}
              style={{ '--label-color': c.color || 'var(--primary-color)' }}
            >
              <span className="DepotTile-art" style={this.tileArt(c)} />
              <span className="DepotTile-icon">
                <Icon name={c.open ? c.icon || 'fas fa-folder' : 'fas fa-lock'} />
              </span>
              <span className="DepotTile-name">{c.name}</span>
              <span className="DepotTile-count">{c.open ? t('tiles.count', { count }) : t('tiles.locked', { group: c.groups.join(', ') })}</span>
            </a>
          );
        })}
      </div>
    );
  }

  /** A tile shows a screenshot from one of its own files, when this page has one. */
  tileArt(c: DepotCategory) {
    const ids: (string | null)[] = [c.slug, ...childrenOf(c.slug).map((s) => s.slug)];
    // Only drawn with the tiles, which wait for the data.
    const file = [...(this.data!.featured || []), ...this.files].find((f) => f.cover && ids.includes(f.category));
    return file ? coverStyle(file) : {};
  }

  setMode(mode: ViewMode) {
    this.mode = mode;
    try {
      localStorage.setItem('depot.view', mode);
    } catch (e) {
      // Private windows refuse storage; the choice simply is not remembered.
    }
  }
}

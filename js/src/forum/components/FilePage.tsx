import type Mithril from 'mithril';
import extractText from 'flarum/common/utils/extractText';
import app from 'flarum/forum/app';
import Page, { IPageAttrs } from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Post from 'flarum/common/models/Post';
import { state, compact, copyText, toggleWatch, showFile, resources } from '../depot-api';
import { t } from './bits';
import DownloadModal, { startDownload } from './DownloadModal';
import type { DepotDiscussion, DepotFile, DepotReview, DepotVersion } from '../types';
import { changes, hasChanges, type ShownFile } from './file/shared';
import { hero, controls } from './file/Hero';
import { overview, more } from './file/Overview';
import { versions } from './file/Versions';
import { reviews, reviewItem, replyEditor } from './file/Reviews';
import { discussion } from './file/Discussion';
import { side } from './file/Sidebar';
import { offer, downloadCard } from './file/DownloadCard';
import { productCard, installCard } from './file/ProductCard';

const TABS = ['overview', 'versions', 'reviews', 'discussion'] as const;
type Tab = (typeof TABS)[number];

/**
 * One file. Laid out like a discussion — hero across the top, content on the
 * left, a sidebar on the right — so it reads as part of the forum. The sidebar
 * holds everything needed to decide and download without scrolling.
 *
 * The pieces are drawn by the helpers in ./file; the methods here stay so each
 * piece can still be reached (and extended) on the page.
 */
export default class FilePage extends Page<IPageAttrs> {
  tab: Tab = 'overview';
  starFilter = 0;
  open: Record<number, boolean> = {};
  file: ShownFile | null = null;
  missing = false;
  replying: number | null = null;
  replyText?: string;
  posts?: Post[] | 'loading';
  copied?: string | boolean;

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);
    this.tab = 'overview';
    this.starFilter = 0;
    this.open = { 0: true };
    this.file = null;
    this.missing = false;
    this.replying = null;
    this.load();
  }

  load() {
    // A linked discussion may have changed: its posts load again when the tab is drawn.
    this.posts = undefined;
    return showFile(m.route.param('slug')).then(
      (file) => {
        state.categories = file.categories;
        // Shared so Waymark's trail can name the file and its categories.
        state.file = file;
        this.file = file;
        m.redraw();
      },
      () => {
        this.missing = true;
        m.redraw();
      }
    );
  }

  view() {
    const file = this.file;
    if (!file) {
      return <PageStructure className="DepotFilePage">{this.missing ? this.notFound() : <LoadingIndicator display="block" />}</PageStructure>;
    }
    app.setTitle(file.title);
    app.setTitleCount(0);

    return (
      <PageStructure className="DepotFilePage" hero={() => this.hero(file)}>
        {this.pending(file)}
        <div className="DepotFile">
          <div className="DepotFile-main">
            {this.tabs(file)}
            <div className="DepotFile-panel" role="tabpanel">
              {this[this.tab](file)}
            </div>
          </div>
          <aside className="DepotFile-side">{this.side(file)}</aside>
        </div>
      </PageStructure>
    );
  }

  /** The awaiting-approval notice, with Approve for a moderator. */
  pending(file: DepotFile) {
    if (file.approved) return null;
    return (
      <div className="DepotNotice">
        <Icon name="fas fa-hourglass-half" />
        <span>{t('file.pending')}</span>
        {file.canModerate ? (
          <Button className="Button Button--small Button--primary" onclick={() => this.act({ isApproved: true })}>
            {t('file.approve')}
          </Button>
        ) : null}
      </div>
    );
  }

  tabs(file: DepotFile) {
    return (
      <nav className="DepotTabs" role="tablist">
        {TABS.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={this.tab === tab ? 'true' : 'false'}
            className={this.tab === tab ? 'is-active' : ''}
            onclick={() => (this.tab = tab)}
          >
            {t(`file.tab_${tab}`)}
            {this.tabCount(file, tab)}
          </button>
        ))}
      </nav>
    );
  }

  /** The uploader may sell their own upload through Kiosk Sellers (Kiosk decides who may sell). */
  sellsOwn(file: DepotFile) {
    const me = app.session.user;
    return !!(
      me &&
      app.forum.attribute('kioskCanSell') &&
      app.routes['kiosk.selling'] &&
      file.user &&
      String(file.user.id) === me.id() &&
      file.source === 'upload' &&
      file.approved
    );
  }

  /** Change the file (approve, feature, sell) and show it again. */
  act(attributes: Record<string, unknown>) {
    return resources.update('depot-files', this.file!.id, attributes).then(() => this.load());
  }

  tabCount(file: DepotFile, tab: Tab) {
    const n = (
      { versions: file.versions.length, reviews: file.ratings, discussion: file.discussion && file.discussion.replies } as Partial<
        Record<Tab, number | null>
      >
    )[tab];
    return n ? <span className="DepotTabs-count">{compact(n)}</span> : null;
  }

  notFound() {
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

  hero(file: DepotFile) {
    return hero(this, file);
  }

  controls(file: DepotFile) {
    return controls(this, file);
  }

  remove(file: DepotFile) {
    // The same confirm Flarum itself uses before deleting a discussion.
    if (!confirm(extractText(t('file.delete_confirm', { title: file.title })))) return;
    resources.remove('depot-files', file.id).then(
      () => m.route.set(app.route('depot.index')),
      () => {
        /* Flarum has shown the error; the file stays on screen. */
      }
    );
  }

  // ---------------------------------------------------------------- overview

  overview(file: DepotFile) {
    return overview(this, file);
  }

  hasChanges(v: DepotVersion) {
    return hasChanges(v);
  }

  more(file: DepotFile) {
    return more(file);
  }

  changes(v: DepotVersion) {
    return changes(v);
  }

  // ---------------------------------------------------------------- versions

  versions(file: DepotFile) {
    return versions(this, file);
  }

  removeVersion(v: DepotVersion) {
    if (!confirm(extractText(t('file.delete_version_confirm', { version: v.version })))) return;
    resources.remove('depot-versions', v.id).then(
      () => this.load(),
      () => {
        /* Flarum has shown the error; the version stays listed. */
      }
    );
  }

  download(file: DepotFile, v: DepotVersion) {
    startDownload(v);
    app.modal.show(DownloadModal, { file, version: v, onwatch: (r: Partial<DepotFile>) => Object.assign(file, r) });
  }

  // ---------------------------------------------------------------- reviews

  reviews(file: DepotFile) {
    return reviews(this, file);
  }

  reviewItem(file: DepotFile, r: DepotReview) {
    return reviewItem(this, file, r);
  }

  replyEditor(r: DepotReview) {
    return replyEditor(this, r);
  }

  helpful(r: DepotReview) {
    resources.update<DepotReview>('depot-reviews', r.id, { isHelpful: !r.helpfulByMe }).then(
      (res) => {
        r.helpful = res.helpful;
        r.helpfulByMe = res.helpfulByMe;
        m.redraw();
      },
      () => {
        /* Flarum has shown the error; nothing changed here before the answer. */
      }
    );
  }

  removeReview(r: DepotReview) {
    if (!confirm(extractText(t('file.delete_review_confirm')))) return;
    resources.remove('depot-reviews', r.id).then(
      () => this.load(),
      () => {
        /* Flarum has shown the error; the review stays listed. */
      }
    );
  }

  // ---------------------------------------------------------------- discussion

  discussion(file: DepotFile) {
    return discussion(this, file);
  }

  /** The latest few posts through Flarum's own API, so permissions, hidden posts and formatting are core's. */
  loadPosts(d: DepotDiscussion) {
    this.posts = 'loading';
    app.store.find<Post[]>('posts', { filter: { discussion: String(d.id), type: 'comment' }, sort: '-createdAt', page: { limit: 4 } }).then(
      (posts) => {
        this.posts = [...posts].reverse();
        m.redraw();
      },
      () => {
        this.posts = [];
        m.redraw();
      }
    );
  }

  // ---------------------------------------------------------------- sidebar

  side(file: DepotFile) {
    return side(this, file);
  }

  offer(file: DepotFile) {
    return offer(file);
  }

  downloadCard(file: DepotFile, v: DepotVersion) {
    return downloadCard(this, file, v);
  }

  productCard(file: DepotFile) {
    return productCard(this, file);
  }

  installCard(file: DepotFile) {
    return installCard(this, file);
  }

  watch(file: DepotFile) {
    toggleWatch(file);
  }

  copy(text: string, id: string | true = true) {
    copyText(text, () => {
      this.copied = id;
      m.redraw();
      setTimeout(() => ((this.copied = false), m.redraw()), 1800);
    });
  }
}

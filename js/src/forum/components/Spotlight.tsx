import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';
import { compact, bytes } from '../depot-api';
import { t, Stars, CategoryLabels, coverStyle } from './bits';
import DownloadModal, { startDownload } from './DownloadModal';
import type { DepotCard, DepotCardVersion } from '../types';

export interface SpotlightAttrs extends ComponentAttrs {
  files: DepotCard[];
}

/**
 * The front of Depot: the featured files, one at a time, as big as the page
 * allows. It moves on by itself every eight seconds, stops while the pointer
 * or keyboard focus is inside it, and never moves for people who have asked
 * their system to reduce motion.
 */
export default class Spotlight extends Component<SpotlightAttrs> {
  index!: number;
  paused!: boolean;
  still!: boolean;
  timer?: ReturnType<typeof setInterval>;

  oninit(vnode: Mithril.Vnode<SpotlightAttrs, this>) {
    super.oninit(vnode);
    this.index = 0;
    this.paused = false;
    this.still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  oncreate(vnode: Mithril.VnodeDOM<SpotlightAttrs, this>) {
    super.oncreate(vnode);
    if (this.still) return;
    this.timer = setInterval(() => {
      if (this.paused || document.hidden) return;
      this.go(this.index + 1);
      m.redraw();
    }, 8000);
  }

  onremove(vnode: Mithril.VnodeDOM<SpotlightAttrs, this>) {
    super.onremove(vnode);
    clearInterval(this.timer);
  }

  /** The spotlight only has the card; the sheet needs the full file. */
  download(file: DepotCard) {
    // Sold through Kiosk: its page has the Buy button, or the download for a buyer.
    if (file.paid) return m.route.set(app.route('depot.file', { slug: file.slug }));
    // Assumes a version, as before: a featured file without one is not guarded here.
    startDownload(file.version!);
    app.modal.show(DownloadModal, { file, version: file.version });
  }

  go(i: number) {
    const n = this.attrs.files.length;
    this.index = (i + n) % n;
  }

  view() {
    const files = this.attrs.files;
    const file = files[this.index];

    return (
      <section
        className="DepotSpotlight"
        aria-roledescription="carousel"
        aria-label={t('spotlight.label')}
        onmouseenter={() => (this.paused = true)}
        onmouseleave={() => (this.paused = false)}
        onfocusin={() => (this.paused = true)}
        onfocusout={() => (this.paused = false)}
      >
        {files.map((f, i) => (
          <div
            className={`DepotSpotlight-art ${i === this.index ? 'is-active' : ''} ${f.cover ? '' : 'Depot-cover--empty'}`}
            style={coverStyle(f, 'full')}
            aria-hidden="true"
          />
        ))}
        <div className="DepotSpotlight-shade" />

        <div className="DepotSpotlight-content Page-container container">
          {[
            <div className="DepotSpotlight-swap" key={file.slug}>
              {this.text(file)}
              {this.side(file)}
            </div>,
          ]}
        </div>

        {this.picker(files)}
      </section>
    );
  }

  /** The current file: what it is, its facts, and what to do with it. */
  text(file: DepotCard) {
    const v: Partial<DepotCardVersion> = file.version || {};

    return (
      <div className="DepotSpotlight-text">
        <span className="DepotSpotlight-eyebrow">
          <Icon name="fas fa-star" /> {t('spotlight.featured')}
        </span>
        <h1 className="DepotSpotlight-title">{file.title}</h1>
        <p className="DepotSpotlight-tagline">{file.tagline}</p>
        <div className="DepotSpotlight-facts">
          {CategoryLabels({ slug: file.category, link: false })}
          {v.version ? <span>v{v.version}</span> : null}
          {file.game || file.compat.length ? <span>{[file.game, file.compat[0]].filter(Boolean).join(' ')}</span> : null}
          {v.size ? <span>{bytes(v.size)}</span> : null}
        </div>
        <div className="DepotSpotlight-actions">{file.source === 'github' ? this.githubActions(file) : this.downloadActions(file, v)}</div>
      </div>
    );
  }

  githubActions(file: DepotCard) {
    return [
      <a className="Button Button--primary Button--large" href={app.route('depot.file', { slug: file.slug })}>
        <Icon name={file.package ? 'fas fa-terminal' : 'fas fa-arrow-right'} /> {file.package ? t('spotlight.install') : t('spotlight.details')}
      </a>,
      <a className="Button Button--large DepotSpotlight-ghost" href={`https://github.com/${file.repo}`} target="_blank" rel="noopener noreferrer">
        <Icon name="fab fa-github" /> GitHub
      </a>,
    ];
  }

  downloadActions(file: DepotCard, v: Partial<DepotCardVersion>) {
    return [
      <Button className="Button Button--primary Button--large" icon="fas fa-download" onclick={() => this.download(file)}>
        {t('spotlight.download', { version: v.version })}
      </Button>,
      <a className="Button Button--large DepotSpotlight-ghost" href={app.route('depot.file', { slug: file.slug })}>
        {t('spotlight.details')}
      </a>,
    ];
  }

  side(file: DepotCard) {
    return (
      <div className="DepotSpotlight-side">
        <div className="DepotSpotlight-stat">
          <b>{compact(file.downloads)}</b>
          <span>{file.source === 'product' ? t('spotlight.sites') : file.package ? t('spotlight.installs') : t('spotlight.downloads')}</span>
        </div>
        {file.ratings ? (
          <div className="DepotSpotlight-stat">
            {/* `ratings` counts them, so `rating` is set whenever it is non-zero. */}
            <b>{file.rating!.toFixed(1)}</b>
            {Stars({ value: file.rating! })}
          </div>
        ) : null}
      </div>
    );
  }

  picker(files: DepotCard[]) {
    return (
      <div className="DepotSpotlight-picker Page-container container">
        {files.map((f, i) => (
          <button
            type="button"
            className={`DepotSpotlight-thumb ${i === this.index ? 'is-active' : ''}`}
            style={coverStyle(f)}
            aria-label={f.title}
            aria-current={i === this.index ? 'true' : undefined}
            onclick={() => this.go(i)}
          >
            <span
              className="DepotSpotlight-progress"
              style={{ animationPlayState: this.paused || this.still ? 'paused' : 'running' }}
              key={`${this.index}-${i}`}
            />
          </button>
        ))}
      </div>
    );
  }
}

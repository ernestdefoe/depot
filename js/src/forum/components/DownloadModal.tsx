import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import type { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';
import { api, bytes, copyText, toggleWatch } from '../depot-api';
import { t, Cover } from './bits';
import type { DepotCard, DepotCardVersion, DepotFile, DepotVersion, DepotWatch } from '../types';

type Os = 'mac' | 'windows' | 'linux';

/** A card's version summary, or a full version from the file's own page. */
type AnyVersion = DepotCardVersion & Partial<Pick<DepotVersion, 'filename' | 'sha256' | 'host'>>;

interface DownloadModalAttrs extends IInternalModalAttrs {
  file: DepotCard | DepotFile;
  version: AnyVersion;
  onwatch?: (r: DepotWatch) => void;
}

const OS: Record<Os, (f: string) => string> = {
  mac: (f) => `shasum -a 256 "${f}"`,
  windows: (f) => `certutil -hashfile "${f}" SHA256`,
  linux: (f) => `sha256sum "${f}"`,
};

function guessOs(): Os {
  // userAgentData is not in TypeScript's DOM types yet.
  const nav = navigator as Navigator & { userAgentData?: { platform: string } };
  const p = (nav.userAgentData && nav.userAgentData.platform) || navigator.platform || '';
  if (/win/i.test(p)) return 'windows';
  if (/linux|x11/i.test(p)) return 'linux';
  return 'mac';
}

/**
 * Start the download, from inside the click that asked for it.
 *
 * An uploaded file goes through a hidden frame, so an error page can never
 * replace the forum; a linked one opens in a new tab, which a browser only
 * allows during the click itself.
 */
export function startDownload(version: Pick<DepotCardVersion, 'external' | 'url'>) {
  if (version.external) {
    window.open(version.url, '_blank', 'noopener');
    return;
  }
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.src = version.url;
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 60000);
}

/**
 * What happens after the click: is the file I got the one they published,
 * what do I do with it, and how do I hear about the next version.
 */
export default class DownloadModal extends Modal<DownloadModalAttrs> {
  os!: Os;
  copied!: string | null;
  file!: DepotFile | null;

  oninit(vnode: Mithril.Vnode<DownloadModalAttrs, this>) {
    super.oninit(vnode);
    this.os = guessOs();
    this.copied = null;
    this.file = this.attrs.file && (this.attrs.file as DepotFile).versions ? (this.attrs.file as DepotFile) : null;

    // The spotlight and cards only carry a summary; the sheet needs the rest.
    if (!this.file) {
      api.get<DepotFile>('file', { slug: this.attrs.file.slug }).then((file) => {
        this.file = file;
        m.redraw();
      });
    }
  }

  className() {
    return 'DepotDownloadModal Modal--medium';
  }

  title() {
    return null;
  }

  version(): AnyVersion {
    const id = this.attrs.version.id;
    return (this.file && this.file.versions.find((v) => v.id === id)) || this.attrs.version;
  }

  content() {
    const file = this.file || this.attrs.file;
    const v = this.version();
    const name = v.external ? null : v.filename || `${file.slug}-${v.version}`;

    return (
      <div className="Modal-body">
        {this.head(file, v, name)}

        {!this.file ? <LoadingIndicator /> : null}

        {this.file && v.sha256 ? this.verify(v.sha256, name) : null}

        {this.file && this.file.install.length ? this.installSteps(this.file) : null}

        {this.file && app.session.user ? this.watchRow(this.file) : null}
      </div>
    );
  }

  /** The cover with a tick, what just happened, and a link to try again. */
  head(file: DepotCard, v: AnyVersion, name: string | null) {
    return (
      <div className="DepotDownload-head">
        {Cover({
          file,
          className: 'DepotDownload-art',
          children: (
            <span className="DepotDownload-check">
              <Icon name="fas fa-check" />
            </span>
          ),
        })}
        <div>
          <h3>{v.external ? t('download.leaving', { host: v.host || file.host || '' }) : t('download.started')}</h3>
          <p className="Depot-dim">{name ? [<code>{name}</code>, v.size ? ` · ${bytes(v.size)}` : ''] : t('download.link_note')}</p>
          <p className="Depot-dim DepotDownload-retry">
            {t('download.retry')}{' '}
            <a href={v.url} target={v.external ? '_blank' : null} rel="noopener">
              {t('download.retry_link')}
            </a>
          </p>
        </div>
      </div>
    );
  }

  /** How to check the checksum, per operating system, and the one to expect. */
  verify(sha256: string, name: string | null) {
    return (
      <section className="DepotDownload-section">
        <h4>
          <Icon name="fas fa-shield-alt" /> {t('download.verify_title')}
        </h4>
        <p className="Depot-dim">{t('download.verify_body')}</p>
        <div className="Depot-segmented" role="tablist">
          {(Object.keys(OS) as Os[]).map((os) => (
            <button
              type="button"
              role="tab"
              aria-selected={this.os === os ? 'true' : 'false'}
              className={this.os === os ? 'is-active' : ''}
              onclick={() => (this.os = os)}
            >
              {t(`download.os_${os}`)}
            </button>
          ))}
        </div>
        {this.copyRow('cmd', OS[this.os](name || 'download'))}
        <div className="DepotDownload-expect">
          <span className="Depot-dim">{t('download.expect')}</span>
          {this.copyRow('sha', sha256, true)}
        </div>
      </section>
    );
  }

  installSteps(file: DepotFile) {
    return (
      <section className="DepotDownload-section">
        <h4>
          <Icon name="fas fa-list-ol" /> {t('download.install_title')}
        </h4>
        <ol className="Depot-steps">
          {file.install.map((step) => (
            <li>{step}</li>
          ))}
        </ol>
      </section>
    );
  }

  /** Watch the file for its next version. */
  watchRow(file: DepotFile) {
    return (
      <div className="DepotDownload-watch">
        <div>
          <b>{t('download.watch_title')}</b>
          <span className="Depot-dim">{t('download.watch_body', { count: file.watchers })}</span>
        </div>
        <Button
          className={`Button ${file.watching ? '' : 'Button--primary'}`}
          icon={file.watching ? 'fas fa-bell' : 'far fa-bell'}
          onclick={() => this.watch()}
        >
          {file.watching ? t('download.watching') : t('download.watch')}
        </Button>
      </div>
    );
  }

  watch() {
    toggleWatch(this.file!).then((r) => this.attrs.onwatch && this.attrs.onwatch(r));
  }

  copyRow(id: string, text: string, small?: boolean) {
    return (
      <div className={`Depot-copy ${small ? 'Depot-copy--small' : ''}`}>
        <code>{text}</code>
        <Button
          className="Button Button--icon"
          icon={this.copied === id ? 'fas fa-check' : 'far fa-copy'}
          aria-label={t('download.copy')}
          onclick={() =>
            copyText(text, () => {
              this.copied = id;
              m.redraw();
              setTimeout(() => ((this.copied = null), m.redraw()), 1800);
            })
          }
        />
      </div>
    );
  }
}

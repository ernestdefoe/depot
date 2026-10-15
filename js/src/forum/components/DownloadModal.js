import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import { artStyle } from '../art';
import { bytes } from '../data';
import { t } from './bits';

const OS = {
  mac: (f) => `shasum -a 256 ${f}`,
  windows: (f) => `certutil -hashfile ${f} SHA256`,
  linux: (f) => `sha256sum ${f}`,
};

function guessOs() {
  const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (/win/i.test(p)) return 'windows';
  if (/linux|x11/i.test(p)) return 'linux';
  return 'mac';
}

/**
 * What happens after the click.
 *
 * Most download pages stop at the button. This one starts the download and
 * then answers the next three questions: is the file I got the file they
 * published, what do I do with it, and how do I hear about the next version.
 */
export default class DownloadModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);
    this.os = guessOs();
    this.copied = null;
    this.watching = false;
  }

  className() {
    return 'DepotDownloadModal Modal--medium';
  }

  title() {
    return null;
  }

  filename() {
    const { file, version } = this.attrs;
    if (file.source === 'link') return null;
    return `${file.slug}-${version.version}.${file.format.toLowerCase()}`;
  }

  content() {
    const { file, version } = this.attrs;
    const name = this.filename();

    return (
      <div className="Modal-body">
        <div className="DepotDownload-head">
          <div className="DepotDownload-art" style={artStyle(file.art)}>
            <span className="DepotDownload-check">
              <Icon name="fas fa-check" />
            </span>
          </div>
          <div>
            <h3>{file.source === 'link' ? t('download.leaving', { host: file.host }) : t('download.started')}</h3>
            <p className="Depot-dim">
              {name ? (
                <>
                  <code>{name}</code> · {bytes(version.size)}
                </>
              ) : (
                t('download.link_note')
              )}
            </p>
            {name ? <p className="Depot-dim DepotDownload-retry">{t('download.retry')}</p> : null}
          </div>
        </div>

        {name ? (
          <section className="DepotDownload-section">
            <h4>
              <Icon name="fas fa-shield-alt" /> {t('download.verify_title')}
            </h4>
            <p className="Depot-dim">{t('download.verify_body')}</p>
            <div className="Depot-segmented" role="tablist">
              {Object.keys(OS).map((os) => (
                <button type="button" role="tab" aria-selected={this.os === os ? 'true' : 'false'} className={this.os === os ? 'is-active' : ''} onclick={() => (this.os = os)}>
                  {t(`download.os_${os}`)}
                </button>
              ))}
            </div>
            {this.copyRow('cmd', OS[this.os](name))}
            <div className="DepotDownload-expect">
              <span className="Depot-dim">{t('download.expect')}</span>
              {this.copyRow('sha', version.sha256, true)}
            </div>
          </section>
        ) : null}

        {file.install && file.install.length ? (
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
        ) : null}

        <div className="DepotDownload-watch">
          <div>
            <b>{t('download.watch_title')}</b>
            <span className="Depot-dim">{t('download.watch_body', { count: file.watchers })}</span>
          </div>
          <Button className={`Button ${this.watching ? '' : 'Button--primary'}`} icon={this.watching ? 'fas fa-bell' : 'far fa-bell'} onclick={() => (this.watching = !this.watching)}>
            {this.watching ? t('download.watching') : t('download.watch')}
          </Button>
        </div>
      </div>
    );
  }

  copyRow(id, text, small) {
    return (
      <div className={`Depot-copy ${small ? 'Depot-copy--small' : ''}`}>
        <code>{text}</code>
        <Button
          className="Button Button--icon"
          icon={this.copied === id ? 'fas fa-check' : 'far fa-copy'}
          aria-label={t('download.copy')}
          onclick={() => {
            const done = () => {
              this.copied = id;
              m.redraw();
              setTimeout(() => ((this.copied = null), m.redraw()), 1800);
            };
            navigator.clipboard ? navigator.clipboard.writeText(text).then(done, () => {}) : null;
          }}
        />
      </div>
    );
  }
}

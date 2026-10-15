import app from 'flarum/forum/app';
import FormModal from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import Alert from 'flarum/common/components/Alert';
import extractText from 'flarum/common/utils/extractText';
import { categories, category, rootOf, bytes } from '../data';
import { t } from './bits';

const STEPS = ['source', 'details', 'media', 'support', 'review'];
const SOURCES = [
  ['upload', 'fas fa-file-upload'],
  ['link', 'fas fa-link'],
  ['github', 'fab fa-github'],
];

/**
 * Upload a file, in four short steps instead of one long form.
 *
 * The checksum is real: a dropped file is hashed in the browser with
 * SubtleCrypto while the member fills in the details, and the server will
 * hash it again on arrival and refuse the upload if the two disagree.
 */
export default class UploadModal extends FormModal {
  oninit(vnode) {
    super.oninit(vnode);
    this.step = 0;
    this.origin = 'upload';
    this.file = null;
    this.hash = null;
    this.hashing = false;
    this.shots = [];
    this.fileTitle = '';
    this.version = '1.0.0';
    this.category = 'maps';
    this.tagline = '';
    this.link = '';
    this.repo = '';
    this.compat = ['1.21.4'];
    this.dragging = false;
    // The support discussion: on unless the member turns it off.
    this.thread = { on: true, tag: null, opening: '' };
  }

  className() {
    return 'DepotUploadModal Modal--medium';
  }

  title() {
    return t('upload.title');
  }

  onremove(vnode) {
    super.onremove(vnode);
    this.shots.forEach((s) => URL.revokeObjectURL(s.url));
  }

  content() {
    return (
      <div className="Modal-body">
        <ol className="DepotSteps">
          {STEPS.map((s, i) => (
            <li className={i === this.step ? 'is-current' : i < this.step ? 'is-done' : ''}>
              <button type="button" disabled={i > this.step} onclick={() => (this.step = i)}>
                <span className="DepotSteps-dot">{i < this.step ? <Icon name="fas fa-check" /> : i + 1}</span>
                <span className="DepotSteps-label">{t(`upload.step_${s}`)}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="DepotUpload-panel">{this[STEPS[this.step]]()}</div>

        <div className="DepotUpload-foot">
          {this.step ? (
            <Button className="Button" onclick={() => this.step--}>
              {t('upload.back')}
            </Button>
          ) : (
            <span />
          )}
          {this.step < STEPS.length - 1 ? (
            <Button className="Button Button--primary" disabled={!this.ready()} onclick={() => this.step++}>
              {t('upload.next')}
            </Button>
          ) : (
            <Button className="Button Button--primary" type="submit" icon="fas fa-paper-plane">
              {t('upload.submit')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  ready() {
    if (STEPS[this.step] === 'source') {
      if (this.origin === 'upload') return this.file && this.hash;
      if (this.origin === 'link') return /^https:\/\/\S+\.\S+/.test(this.link);
      return /^[\w.-]+\/[\w.-]+$/.test(this.repo);
    }
    if (STEPS[this.step] === 'details') return this.fileTitle.trim() && this.version.trim();
    if (STEPS[this.step] === 'support') return !this.thread.on || this.thread.tag;
    return true;
  }

  source() {
    return (
      <div className="DepotUpload-source">
        <div className="DepotChoice" role="radiogroup">
          {SOURCES.map(([key, icon]) => (
            <button type="button" role="radio" aria-checked={this.origin === key ? 'true' : 'false'} className={this.origin === key ? 'is-active' : ''} onclick={() => (this.origin = key)}>
              <Icon name={icon} />
              <b>{t(`upload.source_${key}`)}</b>
              <span>{t(`upload.source_${key}_help`)}</span>
            </button>
          ))}
        </div>

        {this.origin === 'upload' ? this.dropzone() : null}
        {this.origin === 'link' ? (
          <div className="Form-group">
            <label for="depot-link">{t('upload.link_label')}</label>
            <input id="depot-link" className="FormControl" placeholder="https://thunderstore.io/…" value={this.link} oninput={(e) => (this.link = e.target.value)} />
            <p className="helpText">{t('upload.link_help')}</p>
          </div>
        ) : null}
        {this.origin === 'github' ? (
          <div className="Form-group">
            <label for="depot-repo">{t('upload.repo_label')}</label>
            <div className="Depot-inputPrefix">
              <span>github.com/</span>
              <input id="depot-repo" className="FormControl" placeholder="owner/repository" value={this.repo} oninput={(e) => (this.repo = e.target.value.trim())} />
            </div>
            <p className="helpText">{t('upload.repo_help')}</p>
          </div>
        ) : null}
      </div>
    );
  }

  dropzone() {
    const pick = (list) => list && list[0] && this.take(list[0]);
    return (
      <label
        className={`DepotDrop ${this.dragging ? 'is-over' : ''} ${this.file ? 'has-file' : ''}`}
        ondragover={(e) => (e.preventDefault(), (this.dragging = true))}
        ondragleave={() => (this.dragging = false)}
        ondrop={(e) => (e.preventDefault(), (this.dragging = false), pick(e.dataTransfer.files))}
      >
        <input type="file" className="sr-only" onchange={(e) => pick(e.target.files)} />
        {this.file ? (
          <div className="DepotDrop-file">
            <Icon name="fas fa-file-archive" />
            <div>
              <b>{this.file.name}</b>
              <span className="Depot-dim">{bytes(this.file.size)}</span>
              {this.hashing ? (
                <span className="DepotDrop-hash is-working">
                  <Icon name="fas fa-circle-notch fa-spin" /> {t('upload.hashing')}
                </span>
              ) : this.hash ? (
                <span className="DepotDrop-hash">
                  <Icon name="fas fa-shield-alt" /> SHA-256 <code>{this.hash}</code>
                </span>
              ) : null}
            </div>
            <span className="Button Button--small">{t('upload.replace')}</span>
          </div>
        ) : (
          <div className="DepotDrop-empty">
            <Icon name="fas fa-cloud-upload-alt" />
            <b>{t('upload.drop')}</b>
            <span className="Depot-dim">{t('upload.drop_help')}</span>
          </div>
        )}
      </label>
    );
  }

  async take(file) {
    this.file = file;
    this.hash = null;
    this.hashing = true;
    if (!this.fileTitle) this.fileTitle = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    m.redraw();
    try {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      this.hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      this.hash = null;
    }
    this.hashing = false;
    m.redraw();
  }

  details() {
    const versions = ['1.20.6', '1.21', '1.21.1', '1.21.4'];
    return (
      <div className="DepotUpload-details">
        <div className="Form-group">
          <label for="depot-title">{t('upload.name_label')}</label>
          <input id="depot-title" className="FormControl" value={this.fileTitle} oninput={(e) => (this.fileTitle = e.target.value)} />
        </div>
        <div className="Depot-row2">
          <div className="Form-group">
            <label for="depot-cat">{t('upload.category_label')}</label>
            <select id="depot-cat" className="FormControl" value={this.category} onchange={(e) => (this.category = e.target.value)}>
              {categories
                .filter((c) => c.parent || !categories.some((s) => s.parent === c.slug))
                .filter((c) => !c.locked)
                .map((c) => (
                  <option value={c.slug}>{c.parent ? `${rootOf(c).name} › ${c.name}` : c.name}</option>
                ))}
            </select>
          </div>
          <div className="Form-group">
            <label for="depot-version">{t('upload.version_label')}</label>
            <input id="depot-version" className="FormControl" value={this.version} oninput={(e) => (this.version = e.target.value)} />
          </div>
        </div>
        <div className="Form-group">
          <label>{t('upload.compat_label')}</label>
          <div className="DepotToolbar-chips">
            {versions.map((v) => {
              const on = this.compat.includes(v);
              return (
                <button type="button" className={`Depot-chip ${on ? 'is-active' : ''}`} aria-pressed={on ? 'true' : 'false'} onclick={() => (this.compat = on ? this.compat.filter((x) => x !== v) : [...this.compat, v])}>
                  {v}
                </button>
              );
            })}
          </div>
        </div>
        <div className="Form-group">
          <label for="depot-tagline">{t('upload.tagline_label')}</label>
          <input id="depot-tagline" className="FormControl" maxlength="120" placeholder={extractText(t('upload.tagline_placeholder'))} value={this.tagline} oninput={(e) => (this.tagline = e.target.value)} />
          <p className="helpText">{t('upload.tagline_help', { left: 120 - this.tagline.length })}</p>
        </div>
      </div>
    );
  }

  media() {
    const add = (list) => {
      Array.from(list || [])
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, 8 - this.shots.length)
        .forEach((f) => this.shots.push({ name: f.name, url: URL.createObjectURL(f) }));
    };
    return (
      <div className="DepotUpload-media">
        <div className="DepotShots">
          {this.shots.map((s, i) => (
            <div className="DepotShots-item" style={{ backgroundImage: `url(${s.url})` }}>
              {i === 0 ? <span className="Depot-pill">{t('upload.cover')}</span> : null}
              <button type="button" aria-label={t('upload.remove')} onclick={() => (URL.revokeObjectURL(s.url), this.shots.splice(i, 1))}>
                <Icon name="fas fa-times" />
              </button>
            </div>
          ))}
          {this.shots.length < 8 ? (
            <label className="DepotShots-add" ondragover={(e) => e.preventDefault()} ondrop={(e) => (e.preventDefault(), add(e.dataTransfer.files))}>
              <input type="file" accept="image/*" multiple className="sr-only" onchange={(e) => add(e.target.files)} />
              <Icon name="far fa-images" />
              <span>{t('upload.add_shots')}</span>
            </label>
          ) : null}
        </div>
        <p className="helpText">{t('upload.shots_help')}</p>
      </div>
    );
  }

  /**
   * The forum's own tags, when flarum/tags is enabled — they are already in
   * the boot payload, so this costs no request. Only primary tags the member
   * can start a discussion in are offered.
   */
  tags() {
    // Guests see every primary tag, so the step can be previewed signed out;
    // members only see tags they may start a discussion in.
    const all = (app.store.all('tags') || []).filter((tag) => tag.isPrimary() && !tag.parent() && (!app.session.user || tag.canStartDiscussion()));
    return all.map((tag) => ({ id: tag.id(), name: tag.name(), color: tag.color() || 'var(--control-color)', icon: tag.icon(), description: tag.description() }));
  }

  support() {
    const tags = this.tags();
    const th = this.thread;
    if (th.tag === null && tags.length) th.tag = (tags.find((x) => /support|help/i.test(x.name)) || tags[0]).id;
    const chosen = tags.find((x) => x.id === th.tag);
    const title = extractText(t('upload.thread_title', { title: this.fileTitle || '…' }));

    return (
      <div className="DepotUpload-support">
        <label className="DepotToggle">
          <input type="checkbox" checked={th.on} onchange={(e) => (th.on = e.target.checked)} />
          <span className="DepotToggle-track" />
          <span>
            <b>{t('upload.thread_toggle')}</b>
            <span className="Depot-dim">{t('upload.thread_toggle_help')}</span>
          </span>
        </label>

        {th.on ? (
          <>
            <div className="Form-group">
              <label>{t('upload.thread_tag')}</label>
              {tags.length ? (
                <div className="DepotTagPick" role="radiogroup">
                  {tags.map((tag) => (
                    <button type="button" role="radio" aria-checked={th.tag === tag.id ? 'true' : 'false'} className={th.tag === tag.id ? 'is-active' : ''} style={{ '--label-color': tag.color }} onclick={() => (th.tag = tag.id)}>
                      <span className="DepotTagPick-icon">{tag.icon ? <Icon name={tag.icon} /> : null}</span>
                      <span>
                        <b>{tag.name}</b>
                        {tag.description ? <span className="Depot-dim">{tag.description}</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="helpText">{t('upload.thread_no_tags')}</p>
              )}
            </div>

            <div className="Form-group">
              <label for="depot-opening">{t('upload.thread_opening')}</label>
              <textarea id="depot-opening" className="FormControl" rows="3" placeholder={extractText(t('upload.thread_opening_placeholder'))} value={th.opening} oninput={(e) => (th.opening = e.target.value)} />
              <p className="helpText">{t('upload.thread_opening_help')}</p>
            </div>

            <div className="DepotThreadPreview">
              <span className="Depot-dim">{t('upload.thread_preview')}</span>
              <div className="DepotThreadPreview-item">
                <span className="Avatar Avatar--mini" style={{ '--avatar-bg': app.session.user ? app.session.user.color() : '#4d698e' }}>
                  {app.session.user ? app.session.user.displayName().charAt(0).toUpperCase() : '?'}
                </span>
                <div>
                  <b>{title}</b>
                  <div className="DepotThreadPreview-meta">
                    {chosen ? (
                      <span className="Depot-label" style={{ '--label-color': chosen.color }}>
                        {chosen.name}
                      </span>
                    ) : null}
                    <span className="Depot-badge">
                      <Icon name="fas fa-box-open" /> {t('upload.thread_linked')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="DepotNotice DepotNotice--info">
            <Icon name="fas fa-info-circle" />
            <span>{t('upload.thread_off')}</span>
          </div>
        )}
      </div>
    );
  }

  review() {
    const c = category(this.category);
    const root = rootOf(c);
    return (
      <div className="DepotUpload-review">
        <div className="DepotReviewCard">
          <div className="DepotReviewCard-art" style={this.shots[0] ? { backgroundImage: `url(${this.shots[0].url})` } : {}}>
            {!this.shots[0] ? <Icon name="far fa-image" /> : null}
          </div>
          <div>
            <span className="Depot-label" style={{ '--label-color': root.color }}>
              {root.name}
            </span>{' '}
            {c.parent ? (
              <span className="Depot-label Depot-label--outline" style={{ '--label-color': c.color }}>
                {c.name}
              </span>
            ) : null}
            <h3>
              {this.fileTitle} <span className="Depot-dim">v{this.version}</span>
            </h3>
            <p className="Depot-dim">{this.tagline || t('upload.no_tagline')}</p>
            <p className="Depot-dim">
              {this.origin === 'upload' && this.file ? `${this.file.name} · ${bytes(this.file.size)}` : this.origin === 'link' ? this.link : `github.com/${this.repo}`}
            </p>
          </div>
        </div>
        {this.thread.on ? (
          <div className="DepotNotice DepotNotice--info">
            <Icon name="far fa-comments" />
            <span>{t('upload.review_thread', { tag: (this.tags().find((x) => x.id === this.thread.tag) || {}).name || '' })}</span>
          </div>
        ) : null}
        <div className="DepotNotice DepotNotice--info">
          <Icon name="fas fa-user-shield" />
          <span>{t('upload.approval', { category: c.parent ? `${root.name} › ${c.name}` : c.name })}</span>
        </div>
      </div>
    );
  }

  onsubmit(e) {
    e.preventDefault();
    this.hide();
    app.alerts.show(Alert, { type: 'success' }, t('upload.submitted', { title: this.fileTitle }));
  }
}

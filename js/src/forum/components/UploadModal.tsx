import app from 'flarum/forum/app';
import FormModal from 'flarum/common/components/FormModal';
import type { IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import extractText from 'flarum/common/utils/extractText';
import type Mithril from 'mithril';
import type RequestError from 'flarum/common/utils/RequestError';
import { api, category, rootOf, bytes } from '../depot-api';
import { t } from './bits';
import { field, leafCategories, categorySelect, valueOf } from './form/fields';
import { supportTags, tagPicker, threadPreview } from './form/supportThread';
import type { TagChoice, Thread } from './form/supportThread';
import type { DepotCategory, DepotUploadResult } from '../types';

type Step = 'source' | 'details' | 'media' | 'support' | 'review';
type Source = 'upload' | 'link' | 'github';

const STEPS: Step[] = ['source', 'details', 'media', 'support', 'review'];
const SOURCES: [Source, string][] = [
  ['upload', 'fas fa-file-upload'],
  ['link', 'fas fa-link'],
  ['github', 'fab fa-github'],
];

interface Shot {
  file: File;
  url: string;
}

/**
 * Upload a file, in five short steps instead of one long form.
 *
 * A dropped file is hashed in the browser while the member fills in the
 * details, so the checksum is on screen before anything is sent; the server
 * works it out again from the bytes it receives, and that is the one kept.
 */
export default class UploadModal extends FormModal<IFormModalAttrs> {
  step!: number;
  origin!: Source;
  file!: File | null;
  hash!: string | null;
  hashing!: boolean;
  shots!: Shot[];
  fileTitle!: string;
  version!: string;
  category!: string;
  tagline!: string;
  description!: string;
  game!: string;
  compat!: string;
  licence!: string;
  install!: string;
  requires!: string;
  link!: string;
  repo!: string;
  dragging!: boolean;
  progress!: number;
  thread!: Thread;

  oninit(vnode: Mithril.Vnode<IFormModalAttrs, this>) {
    super.oninit(vnode);
    this.step = 0;
    this.origin = 'upload';
    this.file = null;
    this.hash = null;
    this.hashing = false;
    this.shots = [];
    this.fileTitle = '';
    this.version = '1.0.0';
    this.category = (this.leaves()[0] || ({} as Partial<DepotCategory>)).slug || '';
    this.tagline = '';
    this.description = '';
    this.game = '';
    this.compat = '';
    this.licence = '';
    this.install = '';
    this.requires = '';
    this.link = '';
    this.repo = '';
    this.dragging = false;
    this.progress = 0;
    this.thread = { on: true, tag: null, opening: '' };
  }

  className() {
    return 'DepotUploadModal Modal--medium';
  }

  title() {
    return t('upload.title');
  }

  onremove(vnode: Mithril.VnodeDOM<IFormModalAttrs, this>) {
    super.onremove(vnode);
    this.shots.forEach((s) => URL.revokeObjectURL(s.url));
  }

  /** Categories a file can go in: open ones without subcategories of their own. */
  leaves() {
    return leafCategories();
  }

  steps() {
    // When the forum has switched support discussions off, there is nothing to ask.
    return app.forum.attribute('depotSupportThread') === false ? STEPS.filter((s) => s !== 'support') : STEPS;
  }

  content() {
    const steps = this.steps();
    return (
      <div className="Modal-body">
        {this.stepper(steps)}

        <div className="DepotUpload-panel">{this[steps[this.step]]()}</div>

        {this.foot(steps)}
      </div>
    );
  }

  /** The numbered steps along the top; done ones can be gone back to. */
  stepper(steps: Step[]) {
    return (
      <ol className="DepotSteps">
        {steps.map((s, i) => (
          <li className={i === this.step ? 'is-current' : i < this.step ? 'is-done' : ''}>
            <button type="button" disabled={i > this.step || this.loading} onclick={() => (this.step = i)}>
              <span className="DepotSteps-dot">{i < this.step ? <Icon name="fas fa-check" /> : i + 1}</span>
              <span className="DepotSteps-label">{t(`upload.step_${s}`)}</span>
            </button>
          </li>
        ))}
      </ol>
    );
  }

  /** Back, and Next or (on the last step) Submit. */
  foot(steps: Step[]) {
    return (
      <div className="DepotUpload-foot">
        {this.step ? (
          <Button className="Button" disabled={this.loading} onclick={() => this.step--}>
            {t('upload.back')}
          </Button>
        ) : (
          <span />
        )}
        {this.step < steps.length - 1 ? (
          <Button className="Button Button--primary" disabled={!this.ready()} onclick={() => this.step++}>
            {t('upload.next')}
          </Button>
        ) : (
          <Button className="Button Button--primary" type="submit" icon="fas fa-paper-plane" loading={this.loading}>
            {this.loading && this.progress ? t('upload.sending', { percent: Math.round(this.progress * 100) }) : t('upload.submit')}
          </Button>
        )}
      </div>
    );
  }

  ready() {
    const step = this.steps()[this.step];
    if (step === 'source') {
      if (this.origin === 'upload') return this.file && this.hash && !this.tooLarge();
      if (this.origin === 'link') return /^https:\/\/\S+\.\S+/.test(this.link);
      return /^[\w.-]+\/[\w.-]+$/.test(this.repo);
    }
    if (step === 'details') return this.fileTitle.trim() && (this.origin === 'github' || this.version.trim()) && this.category;
    if (step === 'support') return !this.thread.on || !this.tags().length || this.thread.tag;
    return true;
  }

  maxBytes() {
    return app.forum.attribute<number>('depotMaxUploadMb') * 1048576;
  }

  tooLarge() {
    return this.file && this.file.size > this.maxBytes();
  }

  source() {
    return (
      <div className="DepotUpload-source">
        <div className="DepotChoice" role="radiogroup">
          {SOURCES.map(([key, icon]) => (
            <button
              type="button"
              role="radio"
              aria-checked={this.origin === key ? 'true' : 'false'}
              className={this.origin === key ? 'is-active' : ''}
              onclick={() => (this.origin = key)}
            >
              <Icon name={icon} />
              <b>{t(`upload.source_${key}`)}</b>
              <span>{t(`upload.source_${key}_help`)}</span>
            </button>
          ))}
        </div>

        {this.origin === 'upload' ? this.dropzone() : null}
        {this.origin === 'link'
          ? field('depot-link', t('upload.link_label'), this.link, (v) => (this.link = v.trim()), { placeholder: 'https://…' }, t('upload.link_help'))
          : null}
        {this.origin === 'github' ? this.repoField() : null}
      </div>
    );
  }

  /** The GitHub repository, as owner/name after a fixed "github.com/". */
  repoField() {
    return (
      <div className="Form-group">
        <label for="depot-repo">{t('upload.repo_label')}</label>
        <div className="Depot-inputPrefix">
          <span>github.com/</span>
          <input
            id="depot-repo"
            className="FormControl"
            placeholder={extractText(t('upload.repo_placeholder'))}
            value={this.repo}
            oninput={(e: Event) => (this.repo = valueOf(e).trim())}
          />
        </div>
        <p className="helpText">{t('upload.repo_help')}</p>
      </div>
    );
  }

  dropzone() {
    const pick = (list: FileList | null) => list && list[0] && this.take(list[0]);
    const mb = this.maxBytes() / 1048576;
    return (
      <label
        className={`DepotDrop ${this.dragging ? 'is-over' : ''} ${this.file ? 'has-file' : ''}`}
        ondragover={(e: DragEvent) => (e.preventDefault(), (this.dragging = true))}
        ondragleave={() => (this.dragging = false)}
        ondrop={(e: DragEvent) => (e.preventDefault(), (this.dragging = false), pick(e.dataTransfer!.files))}
      >
        <input type="file" className="sr-only" onchange={(e: Event) => pick((e.target as HTMLInputElement).files)} />
        {this.file ? (
          this.dropped(this.file, mb)
        ) : (
          <div className="DepotDrop-empty">
            <Icon name="fas fa-cloud-upload-alt" />
            <b>{t('upload.drop')}</b>
            <span className="Depot-dim">{t('upload.drop_help', { mb })}</span>
          </div>
        )}
      </label>
    );
  }

  /** The dropped file: its name, size and checksum (or why there is none yet). */
  dropped(file: File, mb: number) {
    return (
      <div className="DepotDrop-file">
        <Icon name="fas fa-file-archive" />
        <div>
          <b>{file.name}</b>
          <span className="Depot-dim">{bytes(file.size)}</span>
          {this.tooLarge() ? (
            <span className="DepotDrop-hash is-error">{t('upload.too_large', { mb })}</span>
          ) : this.hashing ? (
            <span className="DepotDrop-hash is-working">
              <Icon name="fas fa-circle-notch fa-spin" /> {t('upload.hashing')}
            </span>
          ) : this.hash && this.hash !== 'server' ? (
            <span className="DepotDrop-hash">
              <Icon name="fas fa-shield-alt" /> SHA-256 <code>{this.hash}</code>
            </span>
          ) : null}
        </div>
        <span className="Button Button--small">{t('upload.replace')}</span>
      </div>
    );
  }

  async take(file: File) {
    this.file = file;
    this.hash = null;
    if (!this.fileTitle)
      this.fileTitle = file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    if (this.tooLarge()) return m.redraw();

    this.hashing = true;
    m.redraw();
    try {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      this.hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // A very large file can be more than a browser will hash in memory;
      // the server works the checksum out on arrival either way.
      this.hash = 'server';
    }
    this.hashing = false;
    m.redraw();
  }

  details() {
    return (
      <div className="DepotUpload-details">
        {this.detailsMain()}
        {this.detailsExtra()}
      </div>
    );
  }

  /** Name, category, version, tagline and description. */
  detailsMain() {
    return [
      field('depot-title', t('upload.name_label'), this.fileTitle, (v) => (this.fileTitle = v), { maxlength: 120 }),
      <div className="Depot-row2">
        {categorySelect('depot-cat', this.category, (v) => (this.category = v))}
        {this.origin !== 'github' ? (
          field('depot-version', t('upload.version_label'), this.version, (v) => (this.version = v), { maxlength: 40 })
        ) : (
          <span />
        )}
      </div>,
      field(
        'depot-tagline',
        t('upload.tagline_label'),
        this.tagline,
        (v) => (this.tagline = v),
        { maxlength: 160, placeholder: extractText(t('upload.tagline_placeholder')) },
        t('upload.tagline_help', { left: 160 - this.tagline.length })
      ),
      field('depot-description', t('upload.description_label'), this.description, (v) => (this.description = v), { rows: 4 }),
    ];
  }

  /** Game, compatibility, licence, install steps and requirements. */
  detailsExtra() {
    return [
      <div className="Depot-row2">
        {field('depot-game', t('upload.game_label'), this.game, (v) => (this.game = v), {
          maxlength: 60,
          placeholder: extractText(t('upload.game_placeholder')),
        })}
        {field(
          'depot-compat',
          t('upload.compat_label'),
          this.compat,
          (v) => (this.compat = v),
          { placeholder: '1.21.4, 1.21.3' },
          t('upload.compat_help')
        )}
      </div>,
      field('depot-licence', t('upload.licence_label'), this.licence, (v) => (this.licence = v), {
        maxlength: 60,
        placeholder: 'MIT, CC BY 4.0…',
      }),
      field('depot-install', t('upload.install_label'), this.install, (v) => (this.install = v), { rows: 3 }, t('upload.lines_help')),
      field(
        'depot-requires',
        t('upload.requires_label'),
        this.requires,
        (v) => (this.requires = v),
        { rows: 2, placeholder: extractText(t('upload.requires_placeholder')) },
        t('upload.requires_help')
      ),
    ];
  }

  media() {
    const add = (list: FileList | null | undefined) => {
      Array.from(list || [])
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, 8 - this.shots.length)
        .forEach((f) => this.shots.push({ file: f, url: URL.createObjectURL(f) }));
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
            <label
              className="DepotShots-add"
              ondragover={(e: DragEvent) => e.preventDefault()}
              ondrop={(e: DragEvent) => (e.preventDefault(), add(e.dataTransfer!.files))}
            >
              <input type="file" accept="image/*" multiple className="sr-only" onchange={(e: Event) => add((e.target as HTMLInputElement).files)} />
              <Icon name="far fa-images" />
              <span>{t('upload.add_shots')}</span>
            </label>
          ) : null}
        </div>
        <p className="helpText">{t('upload.shots_help')}</p>
      </div>
    );
  }

  /** The forum's primary tags the member may start a discussion in, from the boot payload. */
  tags(): TagChoice[] {
    return supportTags();
  }

  support() {
    const tags = this.tags();
    const th = this.thread;
    if (th.tag === null && tags.length) th.tag = (tags.find((x) => /support|help/i.test(x.name)) || tags[0]).id;
    const chosen = tags.find((x) => x.id === th.tag);

    return (
      <div className="DepotUpload-support">
        <label className="DepotToggle">
          <input type="checkbox" checked={th.on} onchange={(e: Event) => (th.on = (e.target as HTMLInputElement).checked)} />
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
              {tags.length ? tagPicker(th, tags) : <p className="helpText">{t('upload.thread_no_tags')}</p>}
            </div>

            {field(
              'depot-opening',
              t('upload.thread_opening'),
              th.opening,
              (v) => (th.opening = v),
              { rows: 3, placeholder: extractText(t('upload.thread_opening_placeholder')) },
              t('upload.thread_opening_help')
            )}

            {threadPreview(this.fileTitle, chosen)}
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
    const c: DepotCategory | undefined = category(this.category);
    const root: Partial<DepotCategory> = rootOf(c) || {};
    const where = c ? (c.parent ? `${root.name} › ${c.name}` : c.name) : '';
    const tag = this.tags().find((x) => x.id === this.thread.tag);
    return (
      <div className="DepotUpload-review">
        <div className="DepotReviewCard">
          <div className="DepotReviewCard-art" style={this.shots[0] ? { backgroundImage: `url(${this.shots[0].url})` } : {}}>
            {!this.shots[0] ? <Icon name="far fa-image" /> : null}
          </div>
          <div>
            {c ? (
              <span className="Depot-label" style={{ '--label-color': root.color }}>
                {where}
              </span>
            ) : null}
            <h3>
              {this.fileTitle} {this.origin !== 'github' ? <span className="Depot-dim">v{this.version}</span> : null}
            </h3>
            <p className="Depot-dim">{this.tagline || t('upload.no_tagline')}</p>
            <p className="Depot-dim">
              {this.origin === 'upload' && this.file
                ? `${this.file.name} · ${bytes(this.file.size)}`
                : this.origin === 'link'
                  ? this.link
                  : `github.com/${this.repo}`}
            </p>
          </div>
        </div>
        {this.thread.on && this.steps().includes('support') ? (
          <div className="DepotNotice DepotNotice--info">
            <Icon name="far fa-comments" />
            <span>{tag ? t('upload.review_thread', { tag: tag.name }) : t('upload.review_thread_untagged')}</span>
          </div>
        ) : null}
        <div className="DepotNotice DepotNotice--info">
          <Icon name="fas fa-user-shield" />
          <span>{t('upload.approval', { category: where })}</span>
        </div>
      </div>
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();
    if (this.loading) return;

    const form = new FormData();
    const fields: Record<string, string> = {
      source: this.origin,
      title: this.fileTitle,
      category: this.category,
      version: this.version,
      tagline: this.tagline,
      description: this.description,
      game: this.game,
      compat: this.compat,
      licence: this.licence,
      install: this.install,
      requires: this.requires,
      link: this.link,
      repo: this.repo,
      thread: this.thread.on && this.steps().includes('support') ? '1' : '0',
      threadTag: this.thread.tag || '',
      threadOpening: this.thread.opening,
    };
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    if (this.origin === 'upload' && this.file) form.append('file', this.file);
    this.shots.forEach((s) => form.append('screenshots[]', s.file));

    this.loading = true;
    api
      .upload<DepotUploadResult>('files', form, (p) => ((this.progress = p), m.redraw()))
      .then(
        (r) => {
          this.hide();
          app.alerts.show(
            { type: 'success' },
            r.approved ? t('upload.published', { title: this.fileTitle }) : t('upload.submitted', { title: this.fileTitle })
          );
          m.route.set(app.route('depot.file', { slug: r.slug }));
        },
        (error: RequestError) => {
          this.loading = false;
          this.progress = 0;
          this.onerror(error);
        }
      );
  }
}

import extractText from 'flarum/common/utils/extractText';
import FormModal from 'flarum/common/components/FormModal';
import type { IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type RequestError from 'flarum/common/utils/RequestError';
import type Mithril from 'mithril';
import { api, bytes } from '../depot-api';
import { t } from './bits';
import type { DepotFile } from '../types';

interface VersionModalAttrs extends IFormModalAttrs {
  file: DepotFile;
  onsave?: () => void;
}

type ChangeKind = 'added' | 'changed' | 'fixed';

/**
 * A new version: its number, what changed, and its file (or link). Everyone
 * watching gets a notification once it is saved.
 */
export default class VersionModal extends FormModal<VersionModalAttrs> {
  version!: string;
  added!: string;
  changed!: string;
  fixed!: string;
  link!: string;
  upload!: File | null;
  progress!: number;

  oninit(vnode: Mithril.Vnode<VersionModalAttrs, this>) {
    super.oninit(vnode);
    this.version = '';
    this.added = '';
    this.changed = '';
    this.fixed = '';
    this.link = '';
    this.upload = null;
    this.progress = 0;
  }

  className() {
    return 'DepotVersionModal Modal--medium';
  }

  title() {
    return t('version.title', { title: this.attrs.file.title });
  }

  content() {
    const file = this.attrs.file;
    const latest = file.versions[0];

    if (file.source === 'github') {
      return (
        <div className="Modal-body">
          <p>{t('version.github', { repo: file.repo })}</p>
        </div>
      );
    }

    return (
      <div className="Modal-body">
        <div className="Form-group">
          <label for="depot-v">{t('version.number')}</label>
          <input
            id="depot-v"
            className="FormControl"
            maxlength="40"
            value={this.version}
            oninput={(e: Event) => (this.version = (e.target as HTMLInputElement).value)}
            placeholder={latest ? extractText(t('version.after', { version: latest.version })) : '1.0.0'}
          />
        </div>
        {file.source === 'link' ? this.linkInput() : this.dropzone()}
        {this.box('added', 'fas fa-plus')}
        {this.box('changed', 'fas fa-pen')}
        {this.box('fixed', 'fas fa-wrench')}
        <Button
          className="Button Button--primary Button--block"
          type="submit"
          loading={this.loading}
          disabled={!this.version.trim() || (file.source === 'link' ? !this.link : !this.upload)}
        >
          {this.loading && this.progress ? t('upload.sending', { percent: Math.round(this.progress * 100) }) : t('version.save')}
        </Button>
      </div>
    );
  }

  /** One kind of change, a line each. */
  box(key: ChangeKind, icon: string) {
    return (
      <div className={`Form-group DepotChanges-group--${key}`}>
        <label for={`depot-${key}`} className="DepotChanges-kind">
          <Icon name={icon} /> {t(`file.change_${key}`)}
        </label>
        <textarea
          id={`depot-${key}`}
          className="FormControl"
          rows="2"
          value={this[key]}
          oninput={(e: Event) => (this[key] = (e.target as HTMLTextAreaElement).value)}
          placeholder={t('version.lines').toString()}
        />
      </div>
    );
  }

  /** For a linked file: where the new version lives. */
  linkInput() {
    return (
      <div className="Form-group">
        <label for="depot-vlink">{t('upload.link_label')}</label>
        <input
          id="depot-vlink"
          className="FormControl"
          value={this.link}
          oninput={(e: Event) => (this.link = (e.target as HTMLInputElement).value.trim())}
          placeholder="https://…"
        />
      </div>
    );
  }

  /** For an uploaded file: the new version's file. */
  dropzone() {
    return (
      <label className={`DepotDrop ${this.upload ? 'has-file' : ''}`}>
        <input type="file" className="sr-only" onchange={(e: Event) => (this.upload = (e.target as HTMLInputElement).files![0] || null)} />
        {this.upload ? (
          <div className="DepotDrop-file">
            <Icon name="fas fa-file-archive" />
            <div>
              <b>{this.upload.name}</b>
              <span className="Depot-dim">{bytes(this.upload.size)}</span>
            </div>
            <span className="Button Button--small">{t('upload.replace')}</span>
          </div>
        ) : (
          <div className="DepotDrop-empty">
            <Icon name="fas fa-cloud-upload-alt" />
            <b>{t('upload.drop')}</b>
          </div>
        )}
      </label>
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();
    const form = new FormData();
    (['version', 'added', 'changed', 'fixed', 'link'] as const).forEach((k) => form.append(k, this[k]));
    if (this.upload) form.append('file', this.upload);

    this.loading = true;
    api
      .upload(`files/${this.attrs.file.id}/versions`, form, (p) => ((this.progress = p), m.redraw()))
      .then(
        () => {
          this.hide();
          this.attrs.onsave && this.attrs.onsave();
        },
        (error: RequestError) => {
          this.loading = false;
          this.onerror(error);
        }
      );
  }
}

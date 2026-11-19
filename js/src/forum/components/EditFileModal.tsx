import FormModal from 'flarum/common/components/FormModal';
import type { IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type RequestError from 'flarum/common/utils/RequestError';
import type Mithril from 'mithril';
import { api, resources } from '../depot-api';
import { t } from './bits';
import { field, categorySelect } from './form/fields';
import type { FieldAttrs } from './form/fields';
import type { DepotFile, DepotShot } from '../types';

interface EditFileModalAttrs extends IFormModalAttrs {
  file: DepotFile;
  onsave?: (slug: string) => void;
}

type ValueKey = 'title' | 'category' | 'tagline' | 'description' | 'game' | 'compat' | 'licence' | 'install' | 'requires' | 'fields';

interface AddedShot {
  file: File;
  url: string;
}

/** Change a file's details and screenshots. Versions have their own form. */
export default class EditFileModal extends FormModal<EditFileModalAttrs> {
  values!: Record<ValueKey, string>;
  shots!: DepotShot[];
  added!: AddedShot[];

  oninit(vnode: Mithril.Vnode<EditFileModalAttrs, this>) {
    super.oninit(vnode);
    const f = this.attrs.file;
    this.values = {
      title: f.title,
      category: f.category || '',
      tagline: f.tagline || '',
      description: f.description || '',
      game: f.game || '',
      compat: f.compat.join(', '),
      licence: f.licence || '',
      install: f.install.join('\n'),
      requires: f.requires.map((r) => [r.name, r.note].filter(Boolean).join(' — ') + (r.optional ? ' (optional)' : '')).join('\n'),
      fields: f.fields.map(([k, v]) => `${k}: ${v}`).join('\n'),
    };
    this.shots = [...f.screenshots];
    this.added = [];
  }

  onremove(vnode: Mithril.VnodeDOM<EditFileModalAttrs, this>) {
    super.onremove(vnode);
    this.added.forEach((s) => URL.revokeObjectURL(s.url));
  }

  className() {
    return 'DepotEditModal Modal--medium';
  }

  title() {
    return t('edit.title');
  }

  input(key: ValueKey, label: Mithril.Children, attrs: FieldAttrs = {}, help?: Mithril.Children) {
    return field(`depot-edit-${key}`, label, this.values[key], (v) => (this.values[key] = v), attrs, help);
  }

  content() {
    return (
      <div className="Modal-body">
        {this.input('title', t('upload.name_label'), { maxlength: 120 })}
        {categorySelect('depot-edit-category', this.values.category, (v) => (this.values.category = v))}
        {this.input('tagline', t('upload.tagline_label'), { maxlength: 160 })}
        {this.input('description', t('upload.description_label'), { rows: 5 })}
        <div className="Depot-row2">
          {this.input('game', t('upload.game_label'), { maxlength: 60 })}
          {this.input('compat', t('upload.compat_label'), {}, t('upload.compat_help'))}
        </div>
        {this.input('licence', t('upload.licence_label'), { maxlength: 60 })}
        {this.input('install', t('upload.install_label'), { rows: 3 }, t('upload.lines_help'))}
        {this.input('requires', t('upload.requires_label'), { rows: 2 }, t('upload.requires_help'))}
        {this.input('fields', t('edit.fields_label'), { rows: 2 }, t('edit.fields_help'))}

        {this.screenshots()}

        <Button className="Button Button--primary Button--block" type="submit" loading={this.loading}>
          {t('edit.save')}
        </Button>
      </div>
    );
  }

  /** The screenshots it has, the ones picked to add, and room for more (up to 8). */
  screenshots() {
    return (
      <div className="Form-group">
        <label>{t('upload.step_media')}</label>
        <div className="DepotShots">
          {this.shots.map((s) => (
            <div className="DepotShots-item" style={{ backgroundImage: `url(${s.thumb})` }}>
              <button type="button" aria-label={t('upload.remove')} onclick={() => this.removeShot(s)}>
                <Icon name="fas fa-times" />
              </button>
            </div>
          ))}
          {this.added.map((s, i) => (
            <div className="DepotShots-item" style={{ backgroundImage: `url(${s.url})` }}>
              <button type="button" aria-label={t('upload.remove')} onclick={() => (URL.revokeObjectURL(s.url), this.added.splice(i, 1))}>
                <Icon name="fas fa-times" />
              </button>
            </div>
          ))}
          {this.shots.length + this.added.length < 8 ? (
            <label className="DepotShots-add">
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onchange={(e: Event) =>
                  // A dropped file skips `accept`: keep only images.
                  Array.from((e.target as HTMLInputElement).files!)
                    .filter((f) => f.type.startsWith('image/'))
                    .slice(0, 8 - this.shots.length - this.added.length)
                    .forEach((f) => this.added.push({ file: f, url: URL.createObjectURL(f) }))
                }
              />
              <Icon name="far fa-images" />
              <span>{t('upload.add_shots')}</span>
            </label>
          ) : null}
        </div>
      </div>
    );
  }

  removeShot(s: DepotShot) {
    resources.remove('depot-screenshots', s.id).then(
      () => {
        this.shots = this.shots.filter((x) => x.id !== s.id);
        m.redraw();
      },
      () => {
        /* Flarum has shown the error; the screenshot stays listed. */
      }
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();
    if (this.loading) return;
    const form = new FormData();
    // A file with no category keeps none: an empty one is not sent.
    Object.entries(this.values).forEach(([k, v]) => (k !== 'category' || v) && form.append(k, v));
    this.added.forEach((s) => form.append('screenshots[]', s.file));

    this.loading = true;
    api.upload<{ slug: string }>(`files/${this.attrs.file.id}`, form).then(
      (r) => {
        this.hide();
        this.attrs.onsave && this.attrs.onsave(r.slug);
      },
      (error: RequestError) => {
        this.loading = false;
        this.onerror(error);
      }
    );
  }
}

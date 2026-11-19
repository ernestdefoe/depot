import Modal from 'flarum/common/components/Modal';
import type { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';
import { t } from './bits';
import type { DepotShot } from '../types';

interface LightboxModalAttrs extends IInternalModalAttrs {
  shots: DepotShot[];
  index?: number;
  title: string;
}

/** Screenshots at full size. Arrow keys move between them; Escape closes, as every Flarum modal does. */
export default class LightboxModal extends Modal<LightboxModalAttrs> {
  index!: number;
  keys!: (e: KeyboardEvent) => void;

  oninit(vnode: Mithril.Vnode<LightboxModalAttrs, this>) {
    super.oninit(vnode);
    this.index = this.attrs.index || 0;
    this.keys = (e) => {
      if (e.key === 'ArrowRight') this.move(1);
      if (e.key === 'ArrowLeft') this.move(-1);
    };
  }

  oncreate(vnode: Mithril.VnodeDOM<LightboxModalAttrs, this>) {
    super.oncreate(vnode);
    document.addEventListener('keydown', this.keys);
  }

  onremove(vnode: Mithril.VnodeDOM<LightboxModalAttrs, this>) {
    super.onremove(vnode);
    document.removeEventListener('keydown', this.keys);
  }

  move(d: number) {
    const n = this.attrs.shots.length;
    if (!n) return;
    this.index = (this.index + d + n) % n;
    m.redraw();
  }

  className() {
    return 'DepotLightbox Modal--large';
  }

  title() {
    return `${this.attrs.title} · ${this.index + 1} / ${this.attrs.shots.length}`;
  }

  content() {
    const { shots } = this.attrs;
    return (
      <div className="Modal-body">
        <div className="DepotLightbox-stage">
          <img src={shots[this.index].full} alt={t('file.screenshot', { n: this.index + 1 })} />
          <Button
            className="Button Button--icon DepotLightbox-prev"
            icon="fas fa-chevron-left"
            aria-label={t('lightbox.previous')}
            onclick={() => this.move(-1)}
          />
          <Button
            className="Button Button--icon DepotLightbox-next"
            icon="fas fa-chevron-right"
            aria-label={t('lightbox.next')}
            onclick={() => this.move(1)}
          />
        </div>
        <div className="DepotLightbox-strip">
          {shots.map((s, i) => (
            <button
              type="button"
              className={i === this.index ? 'is-active' : ''}
              style={{ backgroundImage: `url(${s.thumb})` }}
              aria-label={t('file.screenshot', { n: i + 1 })}
              onclick={() => (this.index = i)}
            />
          ))}
        </div>
      </div>
    );
  }
}

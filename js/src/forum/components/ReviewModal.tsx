import FormModal from 'flarum/common/components/FormModal';
import type { IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type RequestError from 'flarum/common/utils/RequestError';
import type Mithril from 'mithril';
import { api } from '../depot-api';
import { t } from './bits';
import type { DepotFile, DepotReview } from '../types';

interface ReviewModalAttrs extends IFormModalAttrs {
  file: DepotFile;
  review: DepotReview | null;
  onsave?: () => void;
}

/** Rate a file and, optionally, say why. One review each; writing again changes it. */
export default class ReviewModal extends FormModal<ReviewModalAttrs> {
  rating!: number;
  hover!: number;
  body!: string;

  oninit(vnode: Mithril.Vnode<ReviewModalAttrs, this>) {
    super.oninit(vnode);
    const r = this.attrs.review;
    this.rating = r ? r.rating : 0;
    this.hover = 0;
    this.body = r ? r.body || '' : '';
  }

  className() {
    return 'DepotReviewModal Modal--small';
  }

  title() {
    return t('review.title', { title: this.attrs.file.title });
  }

  content() {
    const shown = this.hover || this.rating;
    return (
      <div className="Modal-body">
        <div className="DepotStarPick" role="radiogroup" aria-label={t('review.rating')} onmouseleave={() => (this.hover = 0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              role="radio"
              aria-checked={this.rating === n ? 'true' : 'false'}
              aria-label={t('review.stars', { count: n })}
              onmouseenter={() => (this.hover = n)}
              onclick={() => (this.rating = n)}
            >
              <Icon name={n <= shown ? 'fas fa-star' : 'far fa-star'} />
            </button>
          ))}
        </div>
        <p className="DepotStarPick-label Depot-dim">{shown ? t(`review.label_${shown}`) : t('review.pick')}</p>
        <div className="Form-group">
          <label for="depot-review">{t('review.body_label')}</label>
          <textarea
            id="depot-review"
            className="FormControl"
            rows="5"
            maxlength="5000"
            value={this.body}
            oninput={(e: Event) => (this.body = (e.target as HTMLTextAreaElement).value)}
            placeholder={t('review.body_placeholder').toString()}
          />
        </div>
        <Button className="Button Button--primary Button--block" type="submit" loading={this.loading} disabled={!this.rating}>
          {this.attrs.review ? t('review.update') : t('review.submit')}
        </Button>
      </div>
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();
    this.loading = true;
    api.post(`files/${this.attrs.file.id}/review`, { rating: this.rating, body: this.body }).then(
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

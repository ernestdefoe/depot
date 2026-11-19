import type Mithril from 'mithril';
import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import humanTime from 'flarum/common/helpers/humanTime';
import { t } from '../bits';
import type FilePage from '../FilePage';
import type { DepotFile, DepotCategory, DepotVersion, DepotChangelog } from '../../types';

/** Show's response: the file and, like every page response, the categories. */
export type ShownFile = DepotFile & { categories: DepotCategory[] };

export const shortDate = (d: string | null) => dayjs(d).format('ll');

/** humanTime's typing asks for a Date; at runtime it takes the API's ISO string just the same. */
export const when = (iso: string | null | undefined) => humanTime(iso as unknown as Date);

export const KINDS: [keyof DepotChangelog, string][] = [
  ['added', 'fas fa-plus'],
  ['changed', 'fas fa-pen'],
  ['fixed', 'fas fa-wrench'],
];

/** Parts joined with " · ", skipping the empty ones. */
export const dotted = (parts: Mithril.Children[]) =>
  parts.filter(Boolean).reduce<Mithril.Children[]>((out, part, i) => (i ? [...out, ' · ', part] : [part]), []);

export function hasChanges(v: DepotVersion) {
  return KINDS.some(([k]) => v.changelog[k].length);
}

export function changes(v: DepotVersion) {
  if (!hasChanges(v)) return <p className="Depot-dim">{t('file.no_changelog')}</p>;
  return (
    <div className="DepotChanges">
      {KINDS.filter(([k]) => v.changelog[k].length).map(([k, icon]) => (
        <div className={`DepotChanges-group DepotChanges-group--${k}`}>
          <span className="DepotChanges-kind">
            <Icon name={icon} /> {t(`file.change_${k}`)}
          </span>
          <ul>
            {v.changelog[k].map((c) => (
              <li>{c}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Watch, the same on every side card that offers it. */
export function watchButton(page: FilePage, file: DepotFile) {
  return app.session.user ? (
    <Button
      className={`Button DepotWatch ${file.watching ? 'is-active' : ''}`}
      icon={file.watching ? 'fas fa-bell' : 'far fa-bell'}
      onclick={() => page.watch(file)}
    >
      {file.watching ? t('file.watching') : t('file.watch')}
    </Button>
  ) : null;
}

/** A copy button that turns into a tick for a moment once copied. */
export function copyButton(page: FilePage, text: string, id: string | true = true) {
  return (
    <Button
      className="Button Button--icon"
      icon={page.copied === id ? 'fas fa-check' : 'far fa-copy'}
      aria-label={t('download.copy')}
      onclick={() => page.copy(text, id)}
    />
  );
}

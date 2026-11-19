import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import { compact } from '../../depot-api';
import { t, Cover } from '../bits';
import LightboxModal from '../LightboxModal';
import type FilePage from '../FilePage';
import type { DepotFile, DepotVersion } from '../../types';
import { changes, hasChanges } from './shared';

function gallery(file: DepotFile) {
  const shots = file.screenshots;
  if (!shots.length) return null;
  return (
    <div className={`DepotGallery DepotGallery--${Math.min(shots.length, 5)}`}>
      {shots.slice(0, 5).map((shot, i) => (
        <button
          type="button"
          className="DepotGallery-item"
          style={{ backgroundImage: `url(${i === 0 ? shot.full : shot.thumb})` }}
          aria-label={t('file.screenshot', { n: i + 1 })}
          onclick={() => app.modal.show(LightboxModal, { shots, index: i, title: file.title })}
        >
          {i === 4 && shots.length > 5 ? <span>+{shots.length - 5}</span> : null}
        </button>
      ))}
    </div>
  );
}

function prose(file: DepotFile) {
  if (!file.description) return null;
  return (
    <div className="DepotProse">
      {file.description.split(/(?:\r?\n){2,}/).map((p) => (
        <p>{p}</p>
      ))}
    </div>
  );
}

function worksWith(file: DepotFile) {
  if (!(file.compat.length || file.game)) return null;
  return [
    <dt>{t('file.works_with')}</dt>,
    <dd>
      {file.game ? <span className="Depot-dim">{file.game}</span> : null}
      <span className="DepotFacts-chips">
        {file.compat.map((c, i) => (
          <span className={`Depot-chip Depot-chip--static ${i === 0 ? 'is-active' : ''}`}>{c}</span>
        ))}
      </span>
    </dd>,
  ];
}

function facts(file: DepotFile) {
  if (!(file.compat.length || file.game || file.fields.length || file.licence)) return null;
  return (
    <section className="DepotFacts">
      <h3>{t('file.at_a_glance')}</h3>
      <dl>
        {worksWith(file)}
        {file.fields.map(([k, val]) => [<dt>{k}</dt>, <dd>{val}</dd>])}
        {file.licence ? [<dt>{t('file.licence')}</dt>, <dd>{file.licence}</dd>] : null}
      </dl>
    </section>
  );
}

function requires(file: DepotFile) {
  if (!file.requires.length) return null;
  return (
    <section className="DepotRequires">
      <h3>{t('file.requires')}</h3>
      {file.requires.map((r) => (
        <div className="DepotRequires-item">
          <Icon name={r.optional ? 'fas fa-puzzle-piece' : 'fas fa-link'} />
          <div>
            <b>{r.name}</b>
            {r.note ? <span className="Depot-dim">{r.note}</span> : null}
          </div>
          <span className={`Depot-pill ${r.optional ? '' : 'Depot-pill--warn'}`}>{r.optional ? t('file.optional') : t('file.required')}</span>
        </div>
      ))}
    </section>
  );
}

function install(file: DepotFile) {
  if (!file.install.length) return null;
  return (
    <section className="DepotInstall">
      <h3>{t('file.install')}</h3>
      <ol className="Depot-steps">
        {file.install.map((s) => (
          <li>{s}</li>
        ))}
      </ol>
    </section>
  );
}

function latest(page: FilePage, v: DepotVersion | undefined) {
  if (!(v && hasChanges(v))) return null;
  return (
    <section className="DepotLatest">
      <div className="DepotLatest-head">
        <h3>{t('file.whats_new', { version: v.version })}</h3>
        <button type="button" className="Button Button--link" onclick={() => (page.tab = 'versions')}>
          {t('file.all_versions')} <Icon name="fas fa-arrow-right" />
        </button>
      </div>
      {changes(v)}
    </section>
  );
}

export function overview(page: FilePage, file: DepotFile) {
  return (
    <div className="DepotOverview">
      {gallery(file)}

      {prose(file)}

      {facts(file)}

      {requires(file)}

      {install(file)}

      {latest(page, file.versions[0])}

      {page.more(file)}
    </div>
  );
}

export function more(file: DepotFile) {
  if (!file.related.length) return null;
  return (
    <section className="DepotMore">
      <h3>{t('file.more_like_this')}</h3>
      <div className="DepotMore-grid">
        {file.related.map((f) => (
          <a className="DepotMore-item" href={app.route('depot.file', { slug: f.slug })}>
            {Cover({ file: f, className: 'DepotMore-art' })}
            <span>
              <b>{f.title}</b>
              <span className="Depot-dim">
                <Icon name="fas fa-download" /> {compact(f.downloads)}
                {/* A null rating (none yet) shows no number. */}
                {f.ratings && f.rating != null ? [' · ', f.rating.toFixed(1), ' ', <Icon name="fas fa-star" />] : null}
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import { number, compact } from '../../depot-api';
import { t, Sparkline, Avatar } from '../bits';
import type FilePage from '../FilePage';
import type { DepotFile, DepotUser, DepotVersion } from '../../types';
import { copyButton, shortDate } from './shared';

function statsCard(file: DepotFile, v: DepotVersion | undefined) {
  const total30 = file.trend.reduce((a, b) => a + b, 0);
  const product = file.source === 'product';
  return (
    <div className="DepotSideCard">
      {/* A product is licensed, not downloaded: no trend, and no count until there is one, since a zero reads as "nobody uses this". */}
      {!product || file.downloads > 0 ? (
        <div className="DepotSideCard-row">
          <div>
            <b className="DepotSideCard-big">{number(file.downloads)}</b>
            <span className="Depot-dim">{product ? t('file.total_sites') : file.package ? t('file.total_installs') : t('file.total_downloads')}</span>
          </div>
          {!product ? (
            <div className="DepotSideCard-trend">
              {Sparkline({ values: file.trend, width: 120, height: 36 })}
              <span className="Depot-dim">{t('file.last_30', { count: number(total30) })}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <dl className="DepotStats">
        {v && !file.package && !product ? [<dt>{t('file.this_version')}</dt>, <dd>{number(v.downloads)}</dd>] : null}
        <dt>{t('file.first_released')}</dt>
        <dd>{shortDate(file.firstReleased || file.created)}</dd>
        <dt>{t('file.versions')}</dt>
        <dd>{file.versions.length}</dd>
      </dl>
    </div>
  );
}

function shaCard(page: FilePage, v: DepotVersion | undefined) {
  if (!(v && v.sha256)) return null;
  return (
    <div className="DepotSideCard">
      <h4 className="DepotSideCard-label">SHA-256</h4>
      <div className="Depot-copy Depot-copy--small">
        <code>{v.sha256}</code>
        {copyButton(page, v.sha256)}
      </div>
    </div>
  );
}

function sourceCard(file: DepotFile) {
  if (file.source !== 'github') return null;
  return (
    <div className="DepotSideCard DepotSideCard--source">
      <Icon name="fab fa-github" />
      <div>
        <a href={`https://github.com/${file.repo}`} target="_blank" rel="noopener noreferrer">
          <b>{file.repo}</b>
        </a>
        <span className="Depot-dim">{t('file.github_sync')}</span>
      </div>
    </div>
  );
}

function authorCard(file: DepotFile, u: DepotUser | null) {
  if (!u) return null;
  return (
    <div className="DepotSideCard DepotSideCard--author">
      {Avatar({ user: u, className: 'Avatar--large' })}
      <div>
        <b>{u.displayName}</b>
        {file.author ? (
          <span className="Depot-dim">{t('file.author_stats', { files: file.author.files, downloads: compact(file.author.downloads) })}</span>
        ) : null}
      </div>
      <a className="Button Button--small" href={app.route('user', { username: u.slug })}>
        {t('file.view_profile')}
      </a>
    </div>
  );
}

function apiCard(file: DepotFile) {
  return (
    <details className="DepotSideCard DepotApi">
      <summary>
        <Icon name="fas fa-code" /> {t('file.api')}
      </summary>
      <p className="Depot-dim">{t('file.api_help')}</p>
      <pre>{`GET ${file.updateUrl}`}</pre>
    </details>
  );
}

export function side(page: FilePage, file: DepotFile) {
  const v = file.versions[0] as DepotVersion | undefined;
  const product = file.source === 'product';

  return [
    product ? page.productCard(file) : file.source === 'github' ? page.installCard(file) : v ? page.downloadCard(file, v) : null,
    statsCard(file, v),
    shaCard(page, v),
    sourceCard(file),
    authorCard(file, file.user),
    apiCard(file),
  ];
}

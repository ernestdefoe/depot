import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import { bytes, number } from '../../depot-api';
import { t } from '../bits';
import type FilePage from '../FilePage';
import type { DepotFile, DepotVersion } from '../../types';
import { changes, dotted, shortDate } from './shared';

/** The download (or, for GitHub, release notes) button at the foot of one version. */
function versionAction(page: FilePage, file: DepotFile, v: DepotVersion, i: number) {
  if (file.source === 'github') {
    return v.releaseUrl ? (
      <a className={`Button ${i === 0 ? 'Button--primary' : ''}`} href={v.releaseUrl} target="_blank" rel="noopener noreferrer">
        <Icon name="fab fa-github" /> {t('file.release_notes')}
      </a>
    ) : null;
  }
  return file.canDownload ? (
    <Button className={`Button ${i === 0 ? 'Button--primary' : ''}`} icon="fas fa-download" onclick={() => page.download(file, v)}>
      {t('file.download_version', { version: v.version })}
    </Button>
  ) : null;
}

function versionBody(page: FilePage, file: DepotFile, v: DepotVersion, i: number) {
  return (
    <div className="DepotTimeline-body">
      {changes(v)}
      <div className="DepotTimeline-foot">
        {v.sha256 ? (
          <code className="DepotTimeline-sha" title="SHA-256">
            <Icon name="fas fa-shield-alt" /> {v.sha256.slice(0, 16)}…
          </code>
        ) : (
          <span />
        )}
        <span className="DepotTimeline-actions">
          {file.canEdit && file.versions.length > 1 ? (
            <Button
              className="Button Button--icon Button--link"
              icon="far fa-trash-alt"
              aria-label={t('file.delete_version')}
              onclick={() => page.removeVersion(v)}
            />
          ) : null}
          {versionAction(page, file, v, i)}
        </span>
      </div>
    </div>
  );
}

function versionItem(page: FilePage, file: DepotFile, v: DepotVersion, i: number) {
  return (
    <li className={`DepotTimeline-item ${i === 0 ? 'is-latest' : ''} ${page.open[i] ? 'is-open' : ''}`}>
      <span className="DepotTimeline-dot" />
      <div className="DepotTimeline-card">
        <button
          type="button"
          className="DepotTimeline-head"
          aria-expanded={page.open[i] ? 'true' : 'false'}
          onclick={() => (page.open[i] = !page.open[i])}
        >
          <span className="DepotTimeline-version">v{v.version}</span>
          {i === 0 ? <span className="Depot-pill Depot-pill--fresh">{t('file.latest')}</span> : null}
          <span className="Depot-dim">
            {dotted([
              shortDate(v.date),
              file.source === 'github' ? 'GitHub' : v.external ? v.host || t('file.external') : bytes(v.size),
              file.package ? null : t('file.version_downloads', { count: number(v.downloads) }),
            ])}
          </span>
          <Icon name={page.open[i] ? 'fas fa-chevron-up' : 'fas fa-chevron-down'} className="DepotTimeline-caret" />
        </button>
        {page.open[i] ? versionBody(page, file, v, i) : null}
      </div>
    </li>
  );
}

export function versions(page: FilePage, file: DepotFile) {
  return <ol className="DepotTimeline">{file.versions.map((v, i) => versionItem(page, file, v, i))}</ol>;
}

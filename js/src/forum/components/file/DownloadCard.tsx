import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import SplitDropdown from 'flarum/common/components/SplitDropdown';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import { bytes, number } from '../../depot-api';
import { t } from '../bits';
import type FilePage from '../FilePage';
import type { DepotFile, DepotVersion } from '../../types';
import { dotted, watchButton, when } from './shared';

/**
 * A paid file for someone who hasn't bought it: Kiosk's own offer, so every
 * Buy button on the forum is the same.
 */
export function offer(file: DepotFile) {
  // Kiosk's component, typed only on Kiosk's side.
  let LockedNotice: any = null;
  try {
    const mod = flarum.reg.get('ernestdefoe-kiosk', 'forum/components/LockedNotice');
    LockedNotice = mod && (mod.default || mod);
  } catch (e) {
    // Kiosk is absent or its registry lookup failed: the notice shows without a Buy button.
    LockedNotice = null;
  }

  return (
    <div className="DepotOffer">
      <p className="Depot-dim">
        <Icon name="fas fa-lock" /> {t('file.paid_notice')}
      </p>
      {!app.session.user ? (
        <Button className="Button Button--primary Button--large" onclick={() => app.modal.show(() => import('flarum/forum/components/LogInModal'))}>
          {t('file.login_to_buy')}
        </Button>
      ) : LockedNotice ? (
        m(LockedNotice, { type: 'depot-file', id: file.id, title: t('file.buy_title') })
      ) : null}
    </div>
  );
}

/** The download button with older versions in its menu, or why there is none. */
function downloadButton(page: FilePage, file: DepotFile, v: DepotVersion) {
  if (file.canDownload) {
    return (
      <SplitDropdown
        className="DepotDownloadSplit"
        buttonClassName="Button Button--primary Button--large"
        icon="fas fa-download"
        accessibleToggleLabel={t('file.older_versions')}
      >
        <Button icon="fas fa-download" onclick={() => page.download(file, v)}>
          {t('file.download', { version: v.version })}
        </Button>
        {file.versions.slice(1, 8).map((old) => (
          <Button icon="fas fa-history" onclick={() => page.download(file, old)}>
            {t('file.download_old', { version: old.version, time: when(old.date) })}
          </Button>
        ))}
      </SplitDropdown>
    );
  }
  return file.paid ? (
    page.offer(file)
  ) : (
    <Button className="Button Button--large" disabled>
      {app.session.user ? t('file.no_download_permission') : t('file.login_to_download')}
    </Button>
  );
}

/** An uploaded or linked file: the download button, its older versions, and Watch. */
export function downloadCard(page: FilePage, file: DepotFile, v: DepotVersion) {
  return (
    <div className="DepotSideCard DepotSideCard--download">
      {downloadButton(page, file, v)}
      <div className="DepotSideCard-sub">
        {dotted([
          v.external ? v.host : v.filename && v.filename.includes('.') ? v.filename.split('.').pop()!.toUpperCase() : null,
          v.size ? bytes(v.size) : null,
          t('file.released', { time: when(v.date) }),
        ])}
      </div>
      {watchButton(page, file)}
      <div className="DepotSideCard-trust">
        {v.sha256 ? (
          <Tooltip text={t('file.verified_tooltip')}>
            <span>
              <Icon name="fas fa-shield-alt" /> {t('file.verified')}
            </span>
          </Tooltip>
        ) : (
          <span />
        )}
        <span>
          <Icon name="far fa-eye" /> {t('file.watchers', { count: number(file.watchers) })}
        </span>
      </div>
    </div>
  );
}

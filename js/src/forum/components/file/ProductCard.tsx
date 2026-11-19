import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import { number } from '../../depot-api';
import { t, price } from '../bits';
import type FilePage from '../FilePage';
import type { DepotAccess, DepotFile } from '../../types';
import { copyButton, watchButton } from './shared';

/** For someone who owns the product: how to install it, and where to manage the licence. */
function owned(page: FilePage, access: Partial<DepotAccess>) {
  return [
    <div className="DepotOwned">
      <Icon name="fas fa-check-circle" /> {t('file.owned')}
    </div>,
    ...(access.install || []).map((line, i) => (
      <div className="Depot-copy Depot-copy--small">
        <code>{line}</code>
        {copyButton(page, line, `i${i}`)}
      </div>
    )),
    access.manageUrl ? (
      <a className="Button" href={access.manageUrl}>
        {t('file.manage_licence')}
      </a>
    ) : null,
  ];
}

/** For everyone else: the prices and a way to buy. */
function buy(file: DepotFile) {
  return [
    <h4 className="DepotSideCard-label">{t('file.get_it')}</h4>,
    <ul className="DepotTiers">
      {(file.tiers || []).map((tier) => (
        <li>
          <span>{tier.name}</span>
          <b>{price(tier)}</b>
        </li>
      ))}
    </ul>,
    file.buyUrl ? (
      <a className="Button Button--primary Button--large DepotBuy" href={file.buyUrl}>
        <Icon name="fas fa-tag" /> {t('file.buy')}
      </a>
    ) : null,
  ];
}

/**
 * A store's product: its prices and a way to buy it, or — for someone who
 * already owns it — how to install it, in the store's own words.
 */
export function productCard(page: FilePage, file: DepotFile) {
  const access: Partial<DepotAccess> = file.access || {};
  return (
    <div className="DepotSideCard DepotSideCard--download DepotSideCard--product">
      {access.owned ? owned(page, access) : buy(file)}
      {watchButton(page, file)}
    </div>
  );
}

/**
 * A GitHub-linked file is not downloaded from the forum. A Composer package
 * shows the install command (its count is Packagist's installs); anything
 * else links to its releases on GitHub.
 */
export function installCard(page: FilePage, file: DepotFile) {
  const command = file.package ? `composer require ${file.package}` : null;
  return (
    <div className="DepotSideCard DepotSideCard--download DepotSideCard--install">
      {command
        ? [
            <h4 className="DepotSideCard-label">{t('file.install_with_composer')}</h4>,
            <div className="Depot-copy">
              <code>{command}</code>
              {copyButton(page, command, 'install')}
            </div>,
          ]
        : null}
      <a
        className={`Button Button--large ${command ? '' : 'Button--primary'} DepotGitHubButton`}
        href={`https://github.com/${file.repo}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="fab fa-github" /> {t('file.view_on_github')}
      </a>
      {watchButton(page, file)}
      <div className="DepotSideCard-trust">
        {file.package ? (
          <span>
            <Icon name="fas fa-box" /> {t('file.counted_by_packagist')}
          </span>
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

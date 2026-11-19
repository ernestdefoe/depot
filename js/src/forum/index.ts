import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import LinkButton from 'flarum/common/components/LinkButton';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

export { default as extend } from './extend';

const t = (key: string) => app.translator.trans(`ernestdefoe-depot.forum.${key}`);

app.initializers.add('ernestdefoe-depot', () => {
  extend('flarum/forum/components/NotificationGrid', 'notificationTypes', function (items: ItemList<any>) {
    items.add('depotNewVersion', { name: 'depotNewVersion', icon: 'fas fa-box-open', label: t('settings.notify_new_version') });
    items.add('depotFileApproved', { name: 'depotFileApproved', icon: 'fas fa-check', label: t('settings.notify_approved') });
  });

  extend(IndexSidebar.prototype, 'navItems', function (items: ItemList<Mithril.Children>) {
    if (!app.forum.attribute('canViewDepot')) return;
    items.add('depot', LinkButton.component({ href: app.route('depot.index'), icon: 'fas fa-box-open' }, t('nav.link')), 6);
  });
});

import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';

/*
 * Permissions go into Flarum's own Permissions page, and with flarum/tags they
 * can be scoped per category the same way discussions are scoped per tag.
 * Each is a callback: the translator is not ready when this module runs.
 */
const perm = (permission, icon, section) => [() => ({ icon, permission, label: app.translator.trans(`ernestdefoe-depot.admin.permissions.${permission.split('.')[1]}`) }), section];

export const extend = [
  new Extend.Admin()
    .setting(() => ({ setting: 'ernestdefoe-depot.count_window', type: 'select', options: { 1: app.translator.trans('ernestdefoe-depot.admin.settings.window_1'), 24: app.translator.trans('ernestdefoe-depot.admin.settings.window_24'), 168: app.translator.trans('ernestdefoe-depot.admin.settings.window_168') }, default: '24', label: app.translator.trans('ernestdefoe-depot.admin.settings.count_window'), help: app.translator.trans('ernestdefoe-depot.admin.settings.count_window_help') }))
    .setting(() => ({ setting: 'ernestdefoe-depot.max_upload_mb', type: 'number', min: 1, default: 250, label: app.translator.trans('ernestdefoe-depot.admin.settings.max_upload') }))
    .setting(() => ({ setting: 'ernestdefoe-depot.support_thread', type: 'boolean', default: true, label: app.translator.trans('ernestdefoe-depot.admin.settings.support_thread'), help: app.translator.trans('ernestdefoe-depot.admin.settings.support_thread_help') }))
    .setting(() => ({ setting: 'ernestdefoe-depot.github_sync', type: 'boolean', default: true, label: app.translator.trans('ernestdefoe-depot.admin.settings.github_sync'), help: app.translator.trans('ernestdefoe-depot.admin.settings.github_sync_help') }))
    .permission(...perm('depot.view', 'fas fa-box-open', 'view'))
    .permission(...perm('depot.download', 'fas fa-download', 'view'))
    .permission(...perm('depot.upload', 'fas fa-upload', 'start'))
    .permission(...perm('depot.skipApproval', 'fas fa-check', 'start'))
    .permission(...perm('depot.review', 'far fa-star', 'reply'))
    .permission(...perm('depot.moderate', 'fas fa-gavel', 'moderate')),
];

app.initializers.add('ernestdefoe-depot', () => {});

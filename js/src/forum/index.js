import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import LinkButton from 'flarum/common/components/LinkButton';

/*
 * The pages load on demand, in one chunk, so the forum's every-page bundle
 * carries only this file: the routes and one sidebar link.
 */
const page = (name) => () => import('./depot').then((pages) => ({ default: pages[name] }));
const DepotPage = page('DepotPage');
const FilePage = page('FilePage');

app.initializers.add('ernestdefoe-depot', () => {
  // Each route is also declared in extend.php, so pasted links load.
  app.routes['depot.index'] = { path: '/downloads', component: DepotPage };
  app.routes['depot.category'] = { path: '/downloads/c/:slug', component: DepotPage };
  app.routes['depot.file'] = { path: '/downloads/f/:slug', component: FilePage };

  extend(IndexSidebar.prototype, 'navItems', function (items) {
    items.add(
      'depot',
      LinkButton.component({ href: app.route('depot.index'), icon: 'fas fa-box-open' }, app.translator.trans('ernestdefoe-depot.forum.nav.link')),
      6
    );
  });
});

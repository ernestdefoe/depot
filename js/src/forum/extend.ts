import app from 'flarum/forum/app';
import Extend from 'flarum/common/extenders';
import DepotFile from './models/DepotFile';
import { FileApprovedNotification, NewVersionNotification } from './notifications';
import stylesheet from './stylesheet';

/*
 * The pages load on demand, in one chunk with their own stylesheet, so the
 * forum's every-page bundle carries only the routes, one sidebar link and the
 * notification wiring, and forum.css carries nothing.
 */
let styles: Promise<unknown> | undefined;

/** The page styles, once, resolved when they have arrived so nothing paints unstyled. */
function loadStyles() {
  return (styles ??= new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${app.forum.attribute('baseUrl')}/downloads/stylesheet?v=${stylesheet}`;
    link.onload = link.onerror = resolve;
    document.head.appendChild(link);
  }));
}

const page = (name: 'DepotPage' | 'FilePage') => () => Promise.all([import('./depot'), loadStyles()]).then(([pages]) => ({ default: pages[name] }));

export default [
  // Each route also exists in extend.php, so pasted links load.
  new Extend.Routes()
    .add('depot.index', '/downloads', page('DepotPage'))
    .add('depot.category', '/downloads/c/:slug', page('DepotPage'))
    .add('depot.file', '/downloads/f/:slug', page('FilePage')),

  new Extend.Store().add('depot-files', DepotFile),

  new Extend.Notification().add('depotNewVersion', NewVersionNotification).add('depotFileApproved', FileApprovedNotification),
];

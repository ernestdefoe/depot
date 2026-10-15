import app from 'flarum/forum/app';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import Separator from 'flarum/common/components/Separator';
import ItemList from 'flarum/common/utils/ItemList';
import { categories } from '../data';
import { t } from './bits';
import UploadModal from './UploadModal';

/**
 * Flarum's own index sidebar, with Depot's button and links in it.
 *
 * A subclass rather than lookalike markup: the item names (newDiscussion,
 * nav) and the mobile drop-down are core's, so every theme that styles the
 * discussion sidebar styles this one too. navItems() is replaced, not
 * extended, so other extensions' forum links stay out of Depot's nav.
 */
export default class DepotSidebar extends IndexSidebar {
  items() {
    const items = super.items();

    items.setContent(
      'newDiscussion',
      <Button icon="fas fa-upload" className="Button Button--primary IndexPage-newDiscussion" itemClassName="App-primaryControl" onclick={() => app.modal.show(UploadModal)}>
        {t('nav.upload')}
      </Button>
    );

    return items;
  }

  navItems() {
    const items = new ItemList();

    items.add('depotAll', <LinkButton href={app.route('depot.index')} icon="fas fa-box-open">{t('nav.all')}</LinkButton>, 100);
    items.add('depotWatching', <LinkButton href="#" icon="far fa-bell" onclick={(e) => e.preventDefault()}>{t('nav.watching')}</LinkButton>, 90);
    items.add('depotMine', <LinkButton href="#" icon="far fa-user" onclick={(e) => e.preventDefault()}>{t('nav.mine')}</LinkButton>, 80);
    items.add('depotSeparator', <Separator />, 70);

    categories
      .filter((c) => !c.parent)
      .forEach((c, i) =>
        items.add(
          `depot-${c.slug}`,
          <LinkButton href={app.route('depot.category', { slug: c.slug })} icon={c.icon} className="Depot-nav-root" style={{ '--label-color': c.color }}>
            {c.name}
          </LinkButton>,
          60 - i
        )
      );

    return items;
  }
}

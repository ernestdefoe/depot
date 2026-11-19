import extractText from 'flarum/common/utils/extractText';
import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import CategoryModal from './CategoryModal';
import { resources } from '../../common/jsonapi';
import { loadCategories } from '../categories';
import type { ExtensionPageAttrs } from 'flarum/admin/components/ExtensionPage';
import type Mithril from 'mithril';
import type { DepotCategory, DepotCategoryList } from '../../forum/types';

// `params` left out is the same as passing undefined (the translator defaults it); any[] is trans()'s own type.
const tr = (key: string, params?: Record<string, unknown>): any[] => app.translator.trans(`ernestdefoe-depot.admin.${key}`, params!);

/**
 * Depot's admin page: core's settings and permissions sections, plus the
 * categories, which are drag-and-drop ordered — a root and its children move
 * together, a child dropped on a root joins it.
 */
export default class DepotSettingsPage extends ExtensionPage {
  categories!: DepotCategory[] | null;
  dragging!: number | null;

  oninit(vnode: Mithril.Vnode<ExtensionPageAttrs, this>) {
    super.oninit(vnode);
    this.categories = null;
    this.dragging = null;
    this.reload();
  }

  /** The categories as the server has them (also after a failed change, to undo it on screen). */
  reload() {
    loadCategories().then((r) => this.setCategories(r));
  }

  setCategories(r: DepotCategoryList) {
    this.categories = r.categories;
    m.redraw();
  }

  sections(vnode: Mithril.VnodeDOM<ExtensionPageAttrs, this>) {
    const items = super.sections(vnode);
    items.add('categories', this.categoriesSection(), 90);
    return items;
  }

  categoriesSection() {
    return (
      <div className="ExtensionPage-settings DepotCategories">
        <div className="container">
          <h3 className="ExtensionTitle">{tr('categories.title')}</h3>
          <p className="helpText">{tr('categories.help')}</p>
          {this.categories === null ? <LoadingIndicator /> : this.tree()}
          <Button className="Button" icon="fas fa-plus" onclick={() => this.edit(null)}>
            {tr('categories.add')}
          </Button>
        </div>
      </div>
    );
  }

  tree() {
    // Only drawn once the categories have arrived.
    const categories = this.categories!;
    const roots = categories.filter((c) => !c.parent);
    if (!roots.length) return <p className="DepotCategories-empty">{tr('categories.empty')}</p>;
    return (
      <ol className="DepotCategories-list">
        {roots.map((root) => (
          <li key={root.id}>
            {this.row(root)}
            <ol className="DepotCategories-children">
              {categories
                .filter((c) => c.parent === root.slug)
                .map((child) => (
                  <li key={child.id}>{this.row(child)}</li>
                ))}
            </ol>
          </li>
        ))}
      </ol>
    );
  }

  row(c: DepotCategory) {
    return (
      <div className={`DepotCategories-row ${this.dragging === c.id ? 'is-dragging' : ''}`} draggable="true" {...this.dragHandlers(c)}>
        <Icon name="fas fa-grip-vertical" className="DepotCategories-grip" />
        <span className="DepotCategories-icon" style={{ background: c.color || 'var(--control-bg)' }}>
          <Icon name={c.icon || 'fas fa-folder'} />
        </span>
        <span className="DepotCategories-name">
          <b>{c.name}</b>
          <span className="helpText">
            /downloads/c/{c.slug} ·{' '}
            {tr('categories.files', {
              // Only drawn once the categories have arrived.
              count: c.parent ? c.count : this.categories!.filter((s) => s.parent === c.slug).reduce((n, s) => n + s.count, c.count),
            })}
            {/* The translator returns an array once it interpolates: render it as children, never inside a template string. */}
            {c.locked ? [' · ', tr('categories.locked_to', { groups: c.groups.join(', ') })] : null}
          </span>
        </span>
        <Button className="Button Button--icon" icon="fas fa-pen" aria-label={tr('categories.edit')} onclick={() => this.edit(c)} />
        <Button className="Button Button--icon" icon="far fa-trash-alt" aria-label={tr('categories.delete')} onclick={() => this.remove(c)} />
      </div>
    );
  }

  /** A row is both what is dragged and where it is dropped. */
  dragHandlers(c: DepotCategory) {
    return {
      ondragstart: (e: DragEvent) => {
        this.dragging = c.id;
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('text/plain', String(c.id));
      },
      ondragend: () => (this.dragging = null),
      ondragover: (e: DragEvent) => e.preventDefault(),
      ondrop: (e: DragEvent) => {
        e.preventDefault();
        this.drop(this.dragging, c);
      },
    };
  }

  /**
   * Dropping A on B: a root dropped on a root moves before it; a child dropped
   * on a root joins that root at the top; anything dropped on a child moves
   * beside it, under the same parent. Roots with children stay roots.
   */
  drop(id: number | null, target: DepotCategory) {
    // Rows, and so drops, exist only once the categories have arrived.
    const list = this.categories!;
    const moving = list.find((c) => c.id === id);
    if (!moving || moving.id === target.id) return;
    const hasChildren = list.some((c) => c.parent === moving.slug);

    let parent = target.parent || null;
    if (!target.parent && moving.parent) parent = target.slug;
    if (hasChildren) parent = null;
    moving.parent = parent;

    const rest = list.filter((c) => c.id !== moving.id);
    const at = rest.findIndex((c) => c.id === target.id);
    rest.splice(parent && !target.parent ? at + 1 : at, 0, moving);
    this.categories = rest;

    const bySlug = Object.fromEntries(rest.map((c) => [c.slug, c.id]));
    // The whole tree in one request (a custom endpoint: JSON:API has no bulk update).
    app
      .request<void>({
        method: 'POST',
        url: `${app.forum.attribute('apiUrl')}/depot/categories/order`,
        body: { order: rest.map((c) => ({ id: c.id, parent: c.parent ? bySlug[c.parent] : null })) },
      })
      // Read back either way: the server's counts, or the order as it was.
      .then(
        () => this.reload(),
        () => this.reload()
      );
  }

  edit(category: DepotCategory | null) {
    app.modal.show(CategoryModal, { category, categories: this.categories, onsave: (r: DepotCategoryList) => this.setCategories(r) });
  }

  remove(c: DepotCategory) {
    if (!confirm(extractText(tr('categories.delete_confirm', { name: c.name })))) return;
    resources.remove('depot-categories', c.id).then(
      () => this.reload(),
      () => this.reload()
    );
  }
}

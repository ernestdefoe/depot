import type Mithril from 'mithril';
import { state, rootOf } from '../../depot-api';
import { t } from '../bits';
import type { DepotCategory } from '../../types';

/*
 * Form pieces the upload and edit forms share, so both draw a field the same way.
 */

export interface FieldAttrs {
  rows?: number;
  maxlength?: number;
  placeholder?: string;
}

/** The text in the input, textarea or select an event came from. */
export const valueOf = (e: Event) => (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;

/** A labelled input, or a textarea when `rows` is given, with optional help below. */
export function field(
  id: string,
  label: Mithril.Children,
  value: string,
  set: (value: string) => unknown,
  attrs: FieldAttrs = {},
  help?: Mithril.Children
) {
  const control = attrs.rows ? (
    <textarea id={id} className="FormControl" value={value} oninput={(e: Event) => set(valueOf(e))} {...attrs} />
  ) : (
    <input id={id} className="FormControl" value={value} oninput={(e: Event) => set(valueOf(e))} {...attrs} />
  );
  return (
    <div className="Form-group">
      <label for={id}>{label}</label>
      {control}
      {help ? <p className="helpText">{help}</p> : null}
    </div>
  );
}

/** Categories a file can go in: open ones without subcategories of their own. */
export function leafCategories(): DepotCategory[] {
  const categories: DepotCategory[] = state.categories;
  return categories.filter((c) => c.open && !categories.some((s) => s.parent === c.slug));
}

/** The category picker: subcategories read "Parent › Child". */
export function categorySelect(id: string, value: string, set: (value: string) => unknown) {
  return (
    <div className="Form-group">
      <label for={id}>{t('upload.category_label')}</label>
      <select id={id} className="FormControl" value={value} onchange={(e: Event) => set(valueOf(e))}>
        {leafCategories().map((c) => (
          <option value={c.slug}>{c.parent ? `${rootOf(c)!.name} › ${c.name}` : c.name}</option>
        ))}
      </select>
    </div>
  );
}

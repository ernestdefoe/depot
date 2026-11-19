import { flatten, resources, type ResourceObject } from '../common/jsonapi';
import type { DepotCategory, DepotCategoryList } from '../forum/types';

/** The categories, as the admin page draws them. */
export const loadCategories = (): Promise<DepotCategoryList> =>
  resources.get('depot-categories').then((doc) => ({ categories: (doc.data as ResourceObject[]).map((r) => flatten<DepotCategory>(r)) }));

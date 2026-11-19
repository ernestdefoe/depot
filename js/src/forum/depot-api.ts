import app from 'flarum/forum/app';
import { flatten, resources, type ResourceObject } from '../common/jsonapi';
import type { DepotBrowse, DepotCard, DepotCategory, DepotFile, DepotPriceTier } from './types';

/*
 * Depot's API, and the little state the pages share.
 *
 * Files, reviews, versions and screenshots are JSON:API resources
 * (`resources`, read back into the shapes in types.ts). `api` is for the
 * few endpoints that are not: the multipart uploads.
 */
const url = (path: string) => `${app.forum.attribute('apiUrl')}/depot/${path}`;

export const api = {
  get: <T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> => app.request<T>({ method: 'GET', url: url(path), params }),
  post: <T = unknown>(path: string, body?: unknown): Promise<T> => app.request<T>({ method: 'POST', url: url(path), body }),
  del: <T = unknown>(path: string): Promise<T> => app.request<T>({ method: 'DELETE', url: url(path) }),
  // Multipart: Flarum must not try to JSON-encode the body.
  upload: <T = unknown>(path: string, form: FormData, onprogress?: (fraction: number) => void): Promise<T> =>
    app.request<T>({
      method: 'POST',
      url: url(path),
      body: form,
      serialize: (raw: FormData) => raw,
      config: (xhr: XMLHttpRequest) =>
        onprogress && xhr.upload.addEventListener('progress', (e: ProgressEvent) => e.lengthComputable && onprogress(e.loaded / e.total)),
    }),
};

export { resources };

export interface BrowseParams {
  category: string;
  sort: string;
  q: string;
  compat: string;
  filter: string;
  page: number;
}

const SORTS: Record<string, string> = { downloads: '-downloadCount', rating: '-rating', newest: '-createdAt' };

/** One page of the downloads list, with what the page needs beside it (the list's meta). */
export function browse(params: BrowseParams): Promise<DepotBrowse> {
  const filter: Record<string, string> = {};
  if (params.category) filter.category = params.category;
  if (params.q) filter.q = params.q;
  if (params.compat) filter.compat = params.compat;
  if (params.filter) filter[params.filter] = '1';

  const query: Record<string, unknown> = { filter, page: { offset: params.page * PER_PAGE } };
  if (SORTS[params.sort]) query.sort = SORTS[params.sort];

  return resources.get('depot-files', query).then((doc) => ({
    ...(doc.meta as Omit<DepotBrowse, 'files' | 'hasMore' | 'page'>),
    files: (doc.data as ResourceObject[]).map((r) => flatten<DepotCard>(r)),
    hasMore: !!doc.links?.next,
    page: params.page,
  }));
}

/** The files a page of the list holds (FileResource::PER_PAGE). */
const PER_PAGE = 24;

/** A file's whole page, with the categories for its breadcrumbs. */
export const showFile = (slug: string) =>
  resources
    .get(`depot-files/${encodeURIComponent(slug)}`)
    .then((doc) => ({ ...flatten<DepotFile>(doc.data as ResourceObject), categories: (doc.meta?.categories || []) as DepotCategory[] }));

/** Watch or stop watching a file, from any of the places that offer it. */
export const toggleWatch = (file: Pick<DepotFile, 'id' | 'watching' | 'watchers'>) =>
  resources.update<DepotFile>('depot-files', file.id, { isWatching: !file.watching }).then((r) => {
    file.watching = r.watching;
    file.watchers = r.watchers;
    m.redraw();
    return r;
  });

/** Copy text, then call `done` (to show a tick). */
export function copyText(text: string, done: () => void) {
  if (!navigator.clipboard) return;
  navigator.clipboard.writeText(text).then(done, () => {
    /* The browser refused the clipboard: the text stays on screen to copy by hand. */
  });
}

/** Categories, as last sent by the server. Every page response carries them. */
export const state: { categories: DepotCategory[]; file: DepotFile | null } = { categories: [], file: null };

export const category = (slug: string | null | undefined) => state.categories.find((c) => c.slug === slug);
export const rootOf = (c: DepotCategory | undefined) => (c && c.parent ? category(c.parent) : c);
export const childrenOf = (slug: string) => state.categories.filter((c) => c.parent === slug);
export const roots = () => state.categories.filter((c) => !c.parent);

// --- formatting -------------------------------------------------------------

export function bytes(n: number | null | undefined) {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${u[i]}`;
}

export const number = (n: number | null | undefined) => Number(n || 0).toLocaleString();

export function compact(n: number | null | undefined) {
  const v = Number(n || 0);
  if (v < 1000) return String(v);
  return (v / 1000).toFixed(v < 10000 ? 1 : 0).replace(/\.0$/, '') + 'k';
}

export const daysAgo = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity);

/** "$4.00" in the viewer's own locale, from cents and an ISO currency. */
export function money(cents: number, currency: string | null | undefined) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(
      cents / 100
    );
  } catch (e) {
    // An unknown currency code throws: show the plain amount and the code instead.
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** The cheapest tier, for a card's price. */
export const cheapest = (tiers: DepotPriceTier[] | null | undefined) =>
  (tiers || []).reduce<DepotPriceTier | null>((low, t) => (!low || t.cents < low.cents ? t : low), null);

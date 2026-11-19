import app from 'flarum/forum/app';
import type { DepotCategory, DepotFile, DepotPriceTier, DepotWatch } from './types';

/*
 * Depot's API, and the little state the pages share.
 *
 * Plain JSON endpoints rather than JSON:API resources: Depot's shapes are
 * built for its pages, so the pages ask for exactly what they draw.
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

/** Watch or stop watching a file, from any of the places that offer it. */
export const toggleWatch = (file: Pick<DepotFile, 'id' | 'watching' | 'watchers'>) =>
  api.post<DepotWatch>(`files/${file.id}/watch`, { watch: !file.watching }).then((r) => {
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

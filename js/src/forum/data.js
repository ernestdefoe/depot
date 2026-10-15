/*
 * Sample data for the prototype.
 *
 * Shaped like the API the real extension will serve, so the components do not
 * change when this file is replaced by store calls: files carry their category
 * slug, versions newest first, and counts as numbers, never pre-formatted text.
 */

const DAY = 86400000;
const now = Date.now();
const ago = (days) => new Date(now - days * DAY);

export const users = {
  ernest: { username: 'Ernest', color: '#4d698e', files: 6, downloads: 9814 },
  kestrel: { username: 'kestrel_mc', color: '#7a5ea8', files: 3, downloads: 2410 },
  rune: { username: 'RuneHollow', color: '#b0682f', files: 4, downloads: 4388 },
  blockwright: { username: 'blockwright', color: '#2f855a', files: 2, downloads: 811 },
  tim: { username: 'TailgateTim', color: '#2f5f9e', files: 1, downloads: 509 },
  nightjar: { username: 'nightjar', color: '#a3445f', files: 2, downloads: 402 },
};

export const categories = [
  { slug: 'minecraft', name: 'Minecraft', color: '#4f8a3a', icon: 'fas fa-cube', art: 'meadow', description: 'Packs, maps and shaders for the Aurethil Java realm.' },
  { slug: 'resource-packs', parent: 'minecraft', name: 'Resource packs', color: '#4f8a3a' },
  { slug: 'shaders', parent: 'minecraft', name: 'Shaders', color: '#4f8a3a' },
  { slug: 'maps', parent: 'minecraft', name: 'Maps', color: '#4f8a3a' },
  { slug: 'valheim', name: 'Valheim', color: '#b0682f', icon: 'fas fa-mountain', art: 'fjord', description: 'Server configs and mods for the Valheim world.' },
  { slug: 'configs', parent: 'valheim', name: 'Configs', color: '#b0682f' },
  { slug: 'mods', parent: 'valheim', name: 'Mods', color: '#b0682f' },
  { slug: 'football', name: 'Football', color: '#2f5f9e', icon: 'fas fa-football-ball', art: 'stadium', description: "Sheets and tools from the Pick'em crowd." },
  { slug: 'utilities', name: 'Utilities', color: '#7a5ea8', icon: 'fas fa-toolbox', art: 'circuit', description: 'Small tools that make running a server easier.' },
  { slug: 'founders-vault', name: "Founders' Vault", color: '#6b7686', icon: 'fas fa-lock', art: 'vault', locked: true, group: 'Supporters', description: 'Exclusive packs for Supporters.' },
];

// A 30-day download curve with a bump on each release, so the sparkline tells
// the same story as the version list.
function trend(base, bumps = [], seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 30 }, (_, i) => {
    const day = 29 - i;
    const bump = bumps.reduce((n, b) => n + (day <= b && day > b - 4 ? base * (2.4 - (b - day) * 0.5) : 0), 0);
    const weekend = [0, 6].includes(new Date(now - day * DAY).getDay()) ? 1.35 : 1;
    return Math.max(0, Math.round(base * weekend * (0.75 + rnd() * 0.5) + bump));
  });
}

const RP_CHANGES = [
  {
    version: '2.4.0', date: ago(2), size: 19504332, downloads: 284, sha256: '9f2c4e1a7b03d58e6c91f0a24b7d3e85c16a09f4e2b87d5c3a1f60e98b24c7d1',
    changes: {
      added: ['Trial chamber blocks, vaults and the breeze', 'Heavy core and mace models'],
      changed: ['Redrawn copper in all four oxidation stages'],
      fixed: ['Z-fighting on the quest board model'],
    },
  },
  {
    version: '2.3.2', date: ago(23), size: 18979840, downloads: 611, sha256: '41d0be93a7c2f6e815b4d92c07ae3f68b5d1c49e2a07f3b86d5c1e94a0b72f36',
    changes: { changed: ['Brighter netherite so it reads in dark mines'], fixed: ['Missing texture on the cherry hanging sign', 'Bed overlay in the inventory'] },
  },
  {
    version: '2.3.0', date: ago(42), size: 18769100, downloads: 724, sha256: 'c7e5a19f03b2d846e1f7a3c095d4b28e6f10a7c3d9b5e28f4a61c0d7b3e9f215',
    changes: { added: ["Founders' armour set: models and textures", 'Paintings from the summer contest'], changed: ['Grass and leaves sway less in wind'] },
  },
  {
    version: '2.2.0', date: ago(78), size: 17196000, downloads: 502, sha256: '0b8e3d6f92a14c7e5d03b9f1a68c2e47d5b0f3a19e7c6d24b8a05f1e3c97d6a2',
    changes: { added: ['Animated sea lanterns and prismarine', 'Connected glass (needs OptiFine or Continuity)'] },
  },
  {
    version: '2.1.0', date: ago(130), size: 16012000, downloads: 418, sha256: '5ad3c1e07f9b24d68e3a0c51f7b92d4e8c06a3f15b7d29e4c80a6f3d1b5e7c92',
    changes: { added: ['Custom quest item models'], fixed: ['Seams on the oak log sides'] },
  },
];

export const files = [
  {
    slug: 'aurethil-resource-pack', title: 'Aurethil Resource Pack', category: 'resource-packs', user: 'ernest',
    tagline: 'Hand-drawn 32×32 textures for every block, mob and item in 1.21.',
    art: 'meadow', downloads: 3412, rating: 4.8, ratings: 61, watchers: 117, created: ago(254), source: 'github', repo: 'aurethil/resource-pack',
    format: 'ZIP', licence: 'CC BY-NC 4.0', featured: true,
    compat: ['1.21', '1.21.1', '1.21.2', '1.21.3', '1.21.4'], game: 'Java',
    fields: [['Resolution', '32×32'], ['Loader', 'Vanilla, Fabric, Forge']],
    requires: [{ name: 'OptiFine or Continuity', note: 'Only for connected glass', optional: true }],
    install: ["Download the ZIP. Don't unzip it.", 'Move it into the resourcepacks folder inside .minecraft.', 'In Minecraft, open Options, then Resource Packs, and move it to the right-hand column.'],
    description: [
      'The official texture pack for the Aurethil realm. Every texture is drawn by hand at 32×32, so blocks keep the vanilla feel up close and still read clearly across a valley.',
      "It also adds custom models for the realm's quest items and the Founders' armour set, which only appear with this pack installed.",
    ],
    trend: trend(9, [2, 23], 7),
    versions: RP_CHANGES,
    shots: ['meadow', 'cave', 'village', 'night', 'desert'],
    reviews: [
      { user: 'kestrel', stars: 5, date: ago(3), version: '2.4.0', helpful: 14, body: 'The copper redraw is lovely. Oxidised copper finally looks like it belongs in the same world as everything else.' },
      { user: 'blockwright', stars: 5, date: ago(9), version: '2.3.2', helpful: 9, body: 'Built the whole spawn village with this pack on. Texture sizes are consistent, so nothing looks out of place next to anything else.', reply: 'Thank you! The village is in the 2.3.0 screenshots now.' },
      { user: 'nightjar', stars: 4, date: ago(16), version: '2.3.2', helpful: 4, body: "Great pack. Connected glass needs Continuity on Fabric, which the page does say. One star off because I didn't read it." },
    ],
    distribution: [48, 9, 3, 1, 0],
    posts: [
      { user: 'rune', date: ago(2), body: 'Is there a version without the custom sky? It clashes with my shader.' },
      { user: 'ernest', date: ago(2), body: 'Delete the optifine/sky folder from inside the ZIP and your shader’s sky takes over. I’ll make it a toggle in 2.5.' },
      { user: 'kestrel', date: ago(1), body: 'The breeze texture is perfect. Any chance of a 16×16 version for older machines?' },
    ],
    discussionReplies: 23,
  },
  {
    slug: 'lumen-shaders-lite', title: 'Lumen Shaders Lite', category: 'shaders', user: 'kestrel',
    tagline: 'Soft shadows and warm light that stay above 60 fps on a laptop.',
    art: 'sunset', downloads: 1987, rating: 4.6, ratings: 38, watchers: 64, created: ago(190), source: 'upload', format: 'ZIP', licence: 'All rights reserved', featured: true,
    compat: ['1.20.6', '1.21', '1.21.4'], game: 'Java', requires: [{ name: 'Iris or OptiFine', note: 'Required' }],
    trend: trend(6, [5], 3), latest: { version: '1.9.2', date: ago(5), size: 4300000 },
  },
  {
    slug: 'valheim-server-config', title: 'Valheim Dedicated Server Config', category: 'configs', user: 'rune',
    tagline: 'The exact config our world runs on: backups, crossplay and sane raid timers.',
    art: 'fjord', downloads: 1204, rating: 4.7, ratings: 22, watchers: 40, created: ago(300), source: 'upload', format: 'ZIP', licence: 'MIT',
    compat: ['0.219'], game: 'Dedicated server', trend: trend(3, [9], 11), latest: { version: '3.0.1', date: ago(9), size: 12200 },
  },
  {
    slug: 'bepinex-starter-pack', title: 'BepInEx Starter Pack', category: 'mods', user: 'rune',
    tagline: 'BepInEx plus the eight quality-of-life mods everyone ends up installing.',
    art: 'forge', downloads: 2890, rating: 4.5, ratings: 44, watchers: 88, created: ago(410), source: 'link', host: 'thunderstore.io', format: 'Link', licence: 'Various',
    compat: ['0.219'], game: 'Client', featured: true, trend: trend(8, [12], 5), latest: { version: '5.4.23', date: ago(12), size: 0 },
  },
  {
    slug: 'spawn-village-map', title: 'Spawn Village Map', category: 'maps', user: 'blockwright',
    tagline: 'The Aurethil spawn village as a single-player world, every build included.',
    art: 'village', downloads: 642, rating: 4.9, ratings: 17, watchers: 21, created: ago(120), source: 'upload', format: 'ZIP', licence: 'CC BY 4.0',
    compat: ['1.21.4'], game: 'Java', trend: trend(2, [20], 9), latest: { version: '1.1', date: ago(20), size: 96468992 },
  },
  {
    slug: 'pickem-season-sheet-2026', title: "Pick'em Season Sheet 2026", category: 'football', user: 'tim',
    tagline: 'Every week of the season, with your picks, the spread and the standings worked out for you.',
    art: 'stadium', downloads: 509, rating: 4.4, ratings: 12, watchers: 33, created: ago(60), source: 'upload', format: 'XLSX', licence: 'Free to share',
    compat: ['Excel', 'Google Sheets', 'Numbers'], game: 'Spreadsheet', trend: trend(4, [1, 8], 2), latest: { version: '2026.6', date: ago(1), size: 225280 },
  },
  {
    slug: 'realm-backup-script', title: 'Realm Backup Script', category: 'utilities', user: 'nightjar',
    tagline: 'Nightly world backups with rotation, checksums and a Discord ping when they finish.',
    art: 'circuit', downloads: 318, rating: 4.3, ratings: 9, watchers: 18, created: ago(95), source: 'github', repo: 'nightjar/realm-backup', format: 'TAR.GZ', licence: 'MIT',
    compat: ['Linux', 'macOS'], game: 'Shell', trend: trend(1, [30], 4), latest: { version: '0.8.0', date: ago(30), size: 9400 },
  },
  {
    slug: 'glowberry-caves', title: 'Glowberry Caves', category: 'maps', user: 'kestrel',
    tagline: 'A 600×600 survival map built around one enormous lush cave.',
    art: 'cave', downloads: 401, rating: 4.7, ratings: 11, watchers: 26, created: ago(40), source: 'upload', format: 'ZIP', licence: 'CC BY-NC 4.0',
    compat: ['1.21.1', '1.21.4'], game: 'Java', trend: trend(3, [4], 13), latest: { version: '1.2', date: ago(4), size: 61000000 },
  },
  {
    slug: 'founders-texture-vault', title: "Founders' Texture Vault", category: 'founders-vault', user: 'ernest',
    tagline: '47 variant packs for Supporters.', art: 'vault', locked: true, count: 47,
  },
];

export const pending = 2;

// --- lookups ---------------------------------------------------------------

export const category = (slug) => categories.find((c) => c.slug === slug);
export const rootOf = (c) => (c && c.parent ? category(c.parent) : c);
export const childrenOf = (slug) => categories.filter((c) => c.parent === slug);
export const fileBySlug = (slug) => files.find((f) => f.slug === slug);

export function inCategory(file, slug) {
  if (!slug) return true;
  const c = category(file.category);
  return file.category === slug || (c && c.parent === slug);
}

export function latest(file) {
  return file.versions ? file.versions[0] : file.latest;
}

/** Every file gets a full page in the prototype, not only the one written out by hand. */
export function hydrate(file) {
  if (file.versions || file.locked) return file;
  const l = file.latest;
  const sha = Array.from(file.slug).reduce((h, ch) => ((h * 33) ^ ch.charCodeAt(0)) >>> 0, 5381).toString(16).padStart(8, '0').repeat(8);
  return Object.assign(file, {
    versions: [
      { version: l.version, date: l.date, size: l.size, downloads: Math.round(file.downloads * 0.18), sha256: sha, changes: { added: ['New this release: see the discussion for details'], fixed: ['Fixes reported in the comments'] } },
      { version: 'previous', date: new Date(l.date - 40 * DAY), size: Math.round(l.size * 0.96), downloads: Math.round(file.downloads * 0.4), sha256: sha.split('').reverse().join(''), changes: { added: ['First public release'] } },
    ],
    description: [file.tagline],
    shots: [file.art, file.art + '-2', file.art + '-3'],
    reviews: [],
    distribution: [Math.round(file.ratings * 0.7), Math.round(file.ratings * 0.2), Math.round(file.ratings * 0.07), 1, 0],
    posts: [],
    discussionReplies: Math.round(file.ratings / 2),
    install: [],
    fields: [],
    requires: file.requires || [],
  });
}

// --- formatting -------------------------------------------------------------

export function bytes(n) {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${u[i]}`;
}

export const number = (n) => Number(n).toLocaleString();

export function compact(n) {
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'k';
}

export const daysAgo = (d) => Math.floor((now - d) / DAY);

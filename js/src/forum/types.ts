/*
 * The shapes Depot's API sends, as the pages use them. One place, so every
 * component reads the same names.
 */

export interface DepotUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  slug: string;
}

export interface DepotCategory {
  id: number;
  slug: string;
  name: string;
  parent: string | null;
  description: string | null;
  color: string | null;
  icon: string | null;
  position: number;
  count: number;
  /** Kept to some groups. */
  locked: boolean;
  /** This viewer may use it (a member of one of its groups, or a moderator). */
  open: boolean;
  groups: string[];
  groupIds: number[];
}

export interface DepotShot {
  id: number;
  full: string;
  thumb: string;
  width: number | null;
  height: number | null;
}

export interface DepotIcon {
  name: string;
  color?: string | null;
  backgroundColor?: string | null;
}

export interface DepotPriceTier {
  name: string;
  cents: number;
  currency: string;
  interval: string | null;
}

export interface DepotCardVersion {
  id: number;
  version: string;
  date: string | null;
  size: number;
  external: boolean;
  url: string;
}

/** A file as a card in a list. */
export interface DepotCard {
  id: number;
  slug: string;
  title: string;
  tagline: string | null;
  category: string | null;
  user: DepotUser | null;
  version: DepotCardVersion | null;
  downloads: number;
  rating: number | null;
  ratings: number;
  game: string | null;
  compat: string[];
  source: string;
  repo: string | null;
  package: string | null;
  tiers: DepotPriceTier[] | null;
  buyUrl: string | null;
  host: string | null;
  cover: DepotShot | null;
  icon: DepotIcon | null;
  trend: number[];
  featured: boolean;
  paid: boolean;
  approved: boolean;
  created: string | null;
}

export interface DepotChangelog {
  added: string[];
  changed: string[];
  fixed: string[];
}

export interface DepotVersion {
  id: number;
  version: string;
  date: string | null;
  size: number;
  downloads: number;
  sha256: string | null;
  filename: string | null;
  external: boolean;
  host: string | null;
  changelog: DepotChangelog;
  url: string;
  releaseUrl: string | null;
}

export interface DepotReview {
  id: number;
  user: DepotUser | null;
  rating: number;
  body: string | null;
  reply: string | null;
  repliedAt: string | null;
  helpful: number;
  helpfulByMe: boolean;
  version: string | null;
  date: string | null;
}

export interface DepotDiscussion {
  id: number;
  title: string;
  replies: number;
  url: string;
  tag: { name: string; color: string | null; slug: string } | null;
}

export interface DepotAccess {
  owned: boolean;
  install: string[];
  manageUrl: string | null;
}

/** The whole of one file, for its own page. */
export interface DepotFile extends DepotCard {
  related: DepotCard[];
  description: string | null;
  firstReleased: string | null;
  licence: string | null;
  fields: [string, string][];
  requires: { name: string; note: string; optional: boolean }[];
  install: string[];
  watchers: number;
  watching: boolean;
  versions: DepotVersion[];
  screenshots: DepotShot[];
  reviews: DepotReview[];
  myReview: DepotReview | null;
  distribution: number[];
  discussion: DepotDiscussion | null;
  author: { files: number; downloads: number } | null;
  access: DepotAccess | null;
  canEdit: boolean;
  canLinkDiscussion: boolean;
  canModerate: boolean;
  canReview: boolean;
  canDownload: boolean;
  canSell: boolean;
  updateUrl: string;
}

export interface DepotLockedTeaser {
  slug: string;
  name: string;
  count: number;
  groups: string[];
}

export interface DepotBrowse {
  files: DepotCard[];
  hasMore: boolean;
  page: number;
  categories: DepotCategory[];
  compat: string[];
  featured: DepotCard[];
  locked: DepotLockedTeaser[];
  pending: number;
  canUpload: boolean;
}

/** What watching or unwatching a file answers. */
export interface DepotWatch {
  watching: boolean;
  watchers: number;
}

/** What the server answers once an upload is saved. */
export interface DepotUploadResult {
  slug: string;
  approved: boolean;
}

/** The category list the admin endpoints answer with. */
export interface DepotCategoryList {
  categories: DepotCategory[];
}

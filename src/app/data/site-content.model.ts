/** Relational content schema — maps cleanly to future DB tables. */

export interface NavLink {
  label: string;
  href: string;
}

export interface ContactInfo {
  id: string;
  siteId: string;
  whatsapp: string;
  email: string;
  instagram: string;
  instagramHandle: string;
  visitLines: string[];
  website?: string;
}

export interface HeroContent {
  image: string;
  brand: string;
  /** Wordmark line 1 (e.g. Orbit). */
  brandPrimary: string;
  /** Wordmark line 2 (e.g. Ceramic). */
  brandSecondary: string;
  title: string;
  lede: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface AboutContent {
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  image: string;
  imageAlt: string;
}

export interface CollectionsContent {
  eyebrow: string;
  heading: string;
  lede: string;
  outOfStockLabel: string;
  customNote: string;
  customCtaLabel: string;
  emptyTitle: string;
  emptyLede: string;
  emptyCtaLabel: string;
}

export interface JourneyPageCopy {
  eyebrow: string;
  heading: string;
  lede: string;
  openLabel: string;
  backLabel: string;
  emptyTitle: string;
  emptyLede: string;
  emptyCtaLabel: string;
}

export interface BatchShopCopy {
  eyebrow: string;
  heading: string;
  lede: string;
  buyLabel: string;
  currency: string;
  currencySymbol: string;
}

export interface FooterSocialLink {
  label: string;
  hrefKey: 'instagram' | 'email' | 'website';
}

export interface FooterContent {
  tagline: string;
  visitLabel: string;
  exploreLabel: string;
  followLabel: string;
  exploreLinks: NavLink[];
  socialLinks: FooterSocialLink[];
  copyright: string;
}

/* ——— Table rows (FK = *Id fields) ——— */

export interface SiteRow {
  id: string;
  brand: string;
  activeBatchId: string;
}

export interface NavLinkRow {
  id: string;
  siteId: string;
  label: string;
  href: string;
  sortOrder: number;
}

export interface ProductColorEmbedded {
  id: string;
  name: string;
  hex: string;
  sortOrder: number;
}

export interface ProductImageEmbedded {
  id: string;
  url: string;
  sortOrder: number;
}

/** Product belongs to a batch; owns many colors + many images. */
export interface ProductRow {
  id: string;
  name: string;
  price: number;
  description: string;
  summary: string;
  dimensions: string;
  alt: string;
  sortOrder: number;
  /** Per-product stock; batch.soldOut also marks every item unavailable. */
  soldOut: boolean;
  colors: ProductColorEmbedded[];
  images: ProductImageEmbedded[];
}

export interface BatchRow {
  id: string;
  label: string;
  launchAt: string;
  launchDisplay: string;
  soldOut: boolean;
  sortOrder: number;
  countdownEyebrow: string;
  countdownHeading: string;
  countdownLede: string;
  celebrationHeading: string;
  celebrationLede: string;
  /** One batch → many products */
  products: ProductRow[];
}

export interface JourneyVideoRow {
  id: string;
  batchId: string;
  title: string;
  lede: string;
  posterImage: string;
  videoUrl: string;
  sortOrder: number;
}

export interface PageCopyTables {
  hero: HeroContent;
  about: AboutContent;
  collections: CollectionsContent;
  journey: JourneyPageCopy;
  batchShop: BatchShopCopy;
  footer: FooterContent;
}

/** Root JSON document = hierarchical tables for migration. */
export interface SiteContentDb {
  version: number;
  site: SiteRow;
  contact: ContactInfo;
  navLinks: NavLinkRow[];
  batches: BatchRow[];
  journeyVideos: JourneyVideoRow[];
  pageCopy: PageCopyTables;
}

/* ——— Assembled view models for UI ——— */

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
}

export interface ProductItem {
  id: string;
  batchId: string;
  name: string;
  price: number;
  description: string;
  summary: string;
  dimensions: string;
  colors: ProductColor[];
  alt: string;
  images: string[];
  soldOut: boolean;
}

export interface BatchContent {
  id: string;
  label: string;
  launchAt: string;
  launchDisplay: string;
  soldOut: boolean;
  countdown: {
    eyebrow: string;
    heading: string;
    lede: string;
  };
  celebration: {
    heading: string;
    lede: string;
  };
  shop: BatchShopCopy;
  items: ProductItem[];
}

export interface JourneyBatchCard {
  batch: BatchContent;
  videos: JourneyVideoRow[];
}

/** Hydrated view used by pages/components. */
export interface SiteContent {
  brand: string;
  contact: ContactInfo;
  nav: NavLink[];
  hero: HeroContent;
  about: AboutContent;
  collections: CollectionsContent;
  journey: JourneyPageCopy;
  batch: BatchContent;
  batches: BatchContent[];
  journeyCards: JourneyBatchCard[];
  footer: FooterContent;
}

export function assembleSiteContent(db: SiteContentDb): SiteContent {
  const bySort = <T extends { sortOrder: number }>(rows: T[]) =>
    [...rows].sort((a, b) => a.sortOrder - b.sortOrder);

  const assembleProducts = (batchId: string, products: ProductRow[]): ProductItem[] =>
    bySort(products ?? []).map((product) => ({
      id: product.id,
      batchId,
      name: product.name,
      price: product.price,
      description: product.description,
      summary: product.summary,
      dimensions: product.dimensions,
      alt: product.alt,
      soldOut: Boolean(product.soldOut),
      colors: bySort(product.colors ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        hex: c.hex,
      })),
      images: bySort(product.images ?? []).map((i) => i.url),
    }));

  const assembleBatch = (row: BatchRow): BatchContent => ({
    id: row.id,
    label: row.label,
    launchAt: row.launchAt,
    launchDisplay: row.launchDisplay,
    soldOut: row.soldOut,
    countdown: {
      eyebrow: row.countdownEyebrow,
      heading: row.countdownHeading,
      lede: row.countdownLede,
    },
    celebration: {
      heading: row.celebrationHeading,
      lede: row.celebrationLede,
    },
    shop: db.pageCopy.batchShop,
    items: assembleProducts(row.id, row.products),
  });

  const batchRows = bySort(db.batches);
  if (batchRows.length === 0) {
    throw new Error('site-content.json must include at least one batch row.');
  }

  const batches = batchRows.map(assembleBatch);
  const active =
    batches.find((b) => b.id === db.site.activeBatchId) ?? batches[0];

  const journeyCards: JourneyBatchCard[] = batches
    .map((batch) => ({
      batch,
      videos: bySort(db.journeyVideos.filter((v) => v.batchId === batch.id)),
    }))
    // Journey videos unlock only after the batch goes live.
    .filter((card) => card.videos.length > 0 && isBatchLive(card.batch.launchAt));

  return {
    brand: db.site.brand,
    contact: db.contact,
    nav: bySort(db.navLinks).map(({ label, href }) => ({ label, href })),
    hero: db.pageCopy.hero,
    about: db.pageCopy.about,
    collections: db.pageCopy.collections,
    journey: db.pageCopy.journey,
    batch: active,
    batches,
    journeyCards,
    footer: db.pageCopy.footer,
  };
}

export function whatsappBuyUrl(
  whatsapp: string,
  brand: string,
  productName: string,
  price: number,
  currencySymbol: string,
  batchLabel?: string,
): string {
  const formatted = price.toLocaleString('en-PK');
  const batch = batchLabel ? ` [${batchLabel}]` : '';
  const message = `Hi ${brand}! I'd like to buy: ${productName}${batch} (${currencySymbol} ${formatted}).`;
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

export function whatsappCustomDesignUrl(
  whatsapp: string,
  brand: string,
  productName: string,
  batchLabel: string,
  dimensions: string,
  colors: string[],
): string {
  const colorList = colors.join(', ');
  const message =
    `Hi ${brand}! I love the ${productName} from ${batchLabel}. ` +
    `I'd like a similar piece — same design/form, but color or surface details can change. ` +
    `Reference: ${dimensions}; current colors: ${colorList}.`;
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

export function contactHref(contact: ContactInfo, key: FooterSocialLink['hrefKey']): string {
  if (key === 'email') {
    return `mailto:${contact.email}`;
  }
  return contact[key] ?? '';
}

export function isBatchLive(launchAt: string, now = Date.now()): boolean {
  const launch = Date.parse(launchAt);
  return Number.isFinite(launch) && now >= launch;
}

/** Product is buyable only when neither the batch nor the product is sold out. */
export function isProductUnavailable(batch: Pick<BatchContent, 'soldOut'>, product: Pick<ProductItem, 'soldOut'>): boolean {
  return batch.soldOut || product.soldOut;
}

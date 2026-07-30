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

export interface AboutReview {
  id: string;
  quote: string;
  name: string;
  detail: string;
  /** Star rating from 1 to 5. */
  rating: number;
  /** Optional photo; when empty, gender avatar is used. */
  image?: string;
  imageAlt?: string;
  /** Used for default avatar when image is missing. */
  gender: 'woman' | 'man';
}

export interface AboutContent {
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  image: string;
  imageAlt: string;
  reviewsEyebrow: string;
  reviewsHeading: string;
  reviews: AboutReview[];
}

export interface CollectionsContent {
  eyebrow: string;
  heading: string;
  lede: string;
  outOfStockLabel: string;
  customNote: string;
  customCtaLabel: string;
  viewByBatchLabel: string;
  viewAllLabel: string;
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
  /** Days before/after launchAt when hero highlight images replace the default hero photo. */
  heroWindowDays?: number;
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

/** Still photos for a batch journey (wheel → kiln story). */
export interface JourneyImageRow {
  id: string;
  batchId: string;
  url: string;
  alt: string;
  sortOrder: number;
}

/** Dedicated hero backdrop + thumb images for a batch (FK = batchId). */
export interface HeroHighlightImageRow {
  id: string;
  batchId: string;
  url: string;
  alt: string;
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
  journeyImages?: JourneyImageRow[];
  heroHighlightImages?: HeroHighlightImageRow[];
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
  /** Days before/after launch when hero highlight images apply. */
  heroWindowDays: number;
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
  /** Batch-specific journey stills (card cover + gallery). */
  images: JourneyImageRow[];
  /** Cover for the batch card — first journey image, else first video poster. */
  coverImage: string;
}

export interface HeroHighlightImage {
  url: string;
  alt: string;
}

/** Thumbs from heroHighlightImages table for scheduled / live / recent batches. */
export interface HeroHighlightBatch {
  batchId: string;
  label: string;
  status: 'scheduled' | 'live' | 'recent';
  images: HeroHighlightImage[];
  href: string;
}

const HERO_HIGHLIGHT_IMAGE_CAP = 4;
/** Default days before/after launch when batch.heroWindowDays is omitted. */
const DEFAULT_HERO_WINDOW_DAYS = 10;

/** Hydrated view used by pages/components. */
export interface SiteContent {
  brand: string;
  contact: ContactInfo;
  nav: NavLink[];
  hero: HeroContent;
  heroHighlights: HeroHighlightBatch[];
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
    heroWindowDays:
      typeof row.heroWindowDays === 'number' && row.heroWindowDays >= 0
        ? row.heroWindowDays
        : DEFAULT_HERO_WINDOW_DAYS,
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

  const journeyImages = bySort(db.journeyImages ?? []);
  const heroHighlightRows = bySort(db.heroHighlightImages ?? []);

  const journeyCards: JourneyBatchCard[] = batches
    .map((batch) => {
      const videos = bySort(db.journeyVideos.filter((v) => v.batchId === batch.id));
      const images = journeyImages.filter((img) => img.batchId === batch.id);
      return {
        batch,
        videos,
        images,
        coverImage: images[0]?.url ?? videos[0]?.posterImage ?? '',
      };
    })
    // Journey unlocks after the batch goes live and has video and/or photos.
    .filter(
      (card) =>
        (card.videos.length > 0 || card.images.length > 0) &&
        isBatchLive(card.batch.launchAt),
    );

  const heroHighlights = assembleHeroHighlights(active, batches, heroHighlightRows);
  const heroImage = resolveHeroBackdropImage(
    db.pageCopy.hero.image,
    active,
    batches,
    heroHighlightRows,
  );

  return {
    brand: db.site.brand,
    contact: db.contact,
    nav: bySort(db.navLinks).map(({ label, href }) => ({ label, href })),
    hero: {
      ...db.pageCopy.hero,
      image: heroImage,
    },
    heroHighlights,
    about: db.pageCopy.about,
    collections: db.pageCopy.collections,
    journey: db.pageCopy.journey,
    batch: active,
    batches,
    journeyCards,
    footer: db.pageCopy.footer,
  };
}

function batchHeroImages(
  batchId: string,
  heroHighlightRows: HeroHighlightImageRow[],
): HeroHighlightImage[] {
  return heroHighlightRows
    .filter((row) => row.batchId === batchId)
    .slice(0, HERO_HIGHLIGHT_IMAGE_CAP)
    .map((row) => ({
      url: row.url,
      alt: row.alt,
    }));
}

/** True when now is within the batch hero window (before or after launch). */
export function isWithinHeroLaunchWindow(
  launchAt: string,
  windowDays = DEFAULT_HERO_WINDOW_DAYS,
  now = Date.now(),
): boolean {
  const launch = Date.parse(launchAt);
  if (!Number.isFinite(launch)) {
    return false;
  }
  const windowMs = Math.max(0, windowDays) * 24 * 60 * 60 * 1000;
  return Math.abs(now - launch) <= windowMs;
}

function batchInHeroWindow(batch: BatchContent, now = Date.now()): boolean {
  return isWithinHeroLaunchWindow(batch.launchAt, batch.heroWindowDays, now);
}

/**
 * Prefer first heroHighlightImages row for an in-window batch;
 * otherwise keep the static hero image from pageCopy.
 */
function resolveHeroBackdropImage(
  defaultImage: string,
  active: BatchContent,
  batches: BatchContent[],
  heroHighlightRows: HeroHighlightImageRow[],
  now = Date.now(),
): string {
  if (batchInHeroWindow(active, now)) {
    const activeImage = batchHeroImages(active.id, heroHighlightRows)[0]?.url;
    if (activeImage) {
      return activeImage;
    }
  }

  const recent = [...batches]
    .filter(
      (b) =>
        b.id !== active.id && isBatchLive(b.launchAt, now) && batchInHeroWindow(b, now),
    )
    .sort((a, b) => Date.parse(b.launchAt) - Date.parse(a.launchAt))[0];

  const recentImage = recent
    ? batchHeroImages(recent.id, heroHighlightRows)[0]?.url
    : undefined;
  return recentImage ?? defaultImage;
}

function assembleHeroHighlights(
  active: BatchContent,
  batches: BatchContent[],
  heroHighlightRows: HeroHighlightImageRow[],
  now = Date.now(),
): HeroHighlightBatch[] {
  const rows: HeroHighlightBatch[] = [];

  if (batchInHeroWindow(active, now)) {
    const activeImages = batchHeroImages(active.id, heroHighlightRows);
    if (activeImages.length > 0) {
      rows.push({
        batchId: active.id,
        label: active.label,
        status: isBatchLive(active.launchAt, now) ? 'live' : 'scheduled',
        images: activeImages,
        href: '/batch',
      });
    }
  }

  const recent = [...batches]
    .filter(
      (b) =>
        b.id !== active.id && isBatchLive(b.launchAt, now) && batchInHeroWindow(b, now),
    )
    .sort((a, b) => Date.parse(b.launchAt) - Date.parse(a.launchAt))[0];

  if (recent) {
    const recentImages = batchHeroImages(recent.id, heroHighlightRows);
    if (recentImages.length > 0) {
      rows.push({
        batchId: recent.id,
        label: recent.label,
        status: 'recent',
        images: recentImages,
        href: '/batch',
      });
    }
  }

  return rows;
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

const LAUNCH_CELEBRATION_DAY_MS = 24 * 60 * 60 * 1000;

/** True during the first 24 hours after launch (celebration / confetti window). */
export function isWithinLaunchCelebrationDay(launchAt: string, now = Date.now()): boolean {
  const launch = Date.parse(launchAt);
  if (!Number.isFinite(launch) || now < launch) {
    return false;
  }
  return now - launch < LAUNCH_CELEBRATION_DAY_MS;
}

/** Product is buyable only when neither the batch nor the product is sold out. */
export function isProductUnavailable(batch: Pick<BatchContent, 'soldOut'>, product: Pick<ProductItem, 'soldOut'>): boolean {
  return batch.soldOut || product.soldOut;
}

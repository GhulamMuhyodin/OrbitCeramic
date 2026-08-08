import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import {
  AboutReview,
  BatchRow,
  ContactInfo,
  FooterContent,
  HeroHighlightImageRow,
  JourneyImageRow,
  JourneyVideoRow,
  NavLinkRow,
  ProductRow,
  SiteContentDb,
} from '../data/site-content.model';
import { API_CONFIG } from '../config/api.config';
import { AdminApiService, MediaUploadResult } from './admin-api.service';

function cloneDb(db: SiteContentDb): SiteContentDb {
  return structuredClone(db);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const emptyFooter = (): FooterContent => ({
  tagline: '',
  visitLabel: 'Visit',
  exploreLabel: 'Explore',
  followLabel: 'Follow',
  exploreLinks: [],
  socialLinks: [],
  copyright: '',
});

/**
 * Admin content store backed by orbit-api (MySQL).
 * Keeps an in-memory SiteContentDb for the UI; Save methods persist via HTTP.
 */
@Injectable({ providedIn: 'root' })
export class AdminDbService {
  private readonly api = inject(AdminApiService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly db = signal<SiteContentDb | null>(null);
  readonly dirty = signal(false);
  readonly previewEnabled = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly ready = signal(false);
  readonly saving = signal(false);

  private knownBatchIds = new Set<string>();
  private knownProductIds = new Set<string>();
  private knownReviewIds = new Set<string>();

  load(): Observable<SiteContentDb> {
    return forkJoin({
      bootstrap: this.api.getBootstrap().pipe(
        catchError((err) => {
          console.error(err);
          return throwError(
            () => new Error('Could not load API bootstrap. Is orbit-api running on :8080?'),
          );
        }),
      ),
      chrome: this.api.getChromeJson().pipe(
        catchError(() =>
          of({
            navLinks: [] as NavLinkRow[],
            pageCopy: { footer: emptyFooter() },
          }),
        ),
      ),
      batches: this.api.listBatches().pipe(
        catchError((err) => {
          console.error(err);
          return throwError(
            () => new Error('Could not load the batch list from the API. Check the admin batches endpoint.'),
          );
        }),
      ),
      reviews: this.api.listReviews().pipe(catchError(() => of([] as AboutReview[]))),
    }).pipe(
      map(({ bootstrap, chrome, batches, reviews }) => {
        const db = this.assembleDb(bootstrap, chrome, reviews);
        db.batches = batches;
        return db;
      }),
      tap((db) => {
        this.db.set(cloneDb(db));
        this.syncKnownIds(db);
        this.dirty.set(false);
        this.ready.set(true);
        this.loadError.set(null);
        this.previewEnabled.set(false);
      }),
      catchError((err) => {
        this.loadError.set(err?.message ?? 'Failed to load admin data');
        this.ready.set(true);
        return throwError(() => err);
      }),
    );
  }

  /** Reload from API (replaces old “reset to JSON file”). */
  resetToServerFile(): Observable<SiteContentDb> {
    return this.load();
  }

  getPreviewDb(): SiteContentDb | null {
    return null;
  }

  /** @deprecated Prefer saveBatch / saveSite — kept as no-op clear dirty for layout compatibility. */
  persistDraft(): void {
    this.dirty.set(false);
  }

  markDirty(): void {
    this.dirty.set(true);
  }

  enablePreview(_on: boolean): void {
    this.previewEnabled.set(false);
  }

  downloadJson(): void {
    const current = this.db();
    if (!current || !isPlatformBrowser(this.platformId)) {
      return;
    }
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site-content-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  uploadFile(file: File): Observable<MediaUploadResult> {
    return this.api.uploadMedia(file, API_CONFIG.defaultSiteId);
  }

  saveSiteAndContact(): Observable<unknown> {
    const db = this.db();
    if (!db) {
      return throwError(() => new Error('Not loaded'));
    }
    this.saving.set(true);
    return forkJoin({
      site: this.api.putSite({
        id: db.site.id || API_CONFIG.defaultSiteId,
        brand: db.site.brand,
        activeBatchId: db.site.activeBatchId || (null as unknown as string),
      }),
      contact: this.api.putContact({
        id: db.contact.id,
        whatsapp: db.contact.whatsapp,
        email: db.contact.email,
        instagram: db.contact.instagram,
        instagramHandle: db.contact.instagramHandle,
        website: db.contact.website,
        visitLines: db.contact.visitLines,
      }),
    }).pipe(
      tap(() => {
        this.dirty.set(false);
        this.saving.set(false);
      }),
      catchError((err) => {
        this.saving.set(false);
        return throwError(() => err);
      }),
    );
  }

  saveActiveBatch(): Observable<unknown> {
    const db = this.db();
    if (!db) {
      return throwError(() => new Error('Not loaded'));
    }
    return this.api.putActiveBatch(db.site.activeBatchId || null);
  }

  saveBatch(batchId: string): Observable<unknown> {
    const db = this.db();
    const batch = db?.batches.find((b) => b.id === batchId);
    if (!db || !batch) {
      return throwError(() => new Error('Batch not found'));
    }
    this.saving.set(true);

    const batchBody = {
      id: batch.id,
      label: batch.label,
      launchAt: batch.launchAt,
      launchDisplay: batch.launchDisplay,
      soldOut: batch.soldOut,
      sortOrder: batch.sortOrder,
      heroWindowDays: batch.heroWindowDays ?? 10,
      countdownEyebrow: batch.countdownEyebrow,
      countdownHeading: batch.countdownHeading,
      countdownLede: batch.countdownLede,
      celebrationHeading: batch.celebrationHeading,
      celebrationLede: batch.celebrationLede,
    };

    const batch$ = this.knownBatchIds.has(batchId)
      ? this.api.updateBatch(batchId, batchBody)
      : this.api.createBatch(batchBody).pipe(
          tap((b) => {
            this.knownBatchIds.add(b.id);
          }),
        );

    const journeyVideo = db.journeyVideos.find((v) => v.batchId === batchId);
    const journeyImages = (db.journeyImages ?? []).filter((i) => i.batchId === batchId);
    const highlights = (db.heroHighlightImages ?? []).filter((h) => h.batchId === batchId);

    const journeyPayload = {
      video: journeyVideo
        ? {
            id: journeyVideo.id,
            title: journeyVideo.title,
            lede: journeyVideo.lede,
            posterImage: journeyVideo.posterImage,
            videoUrl: journeyVideo.videoUrl,
            posterMediaId: journeyVideo.posterMediaId,
            videoMediaId: journeyVideo.videoMediaId,
          }
        : null,
      images: journeyImages
        .filter((im) => !!im.mediaId && !!im.url)
        .map((im) => ({
          id: im.id,
          batchId: im.batchId,
          url: im.url,
          alt: im.alt,
          sortOrder: im.sortOrder,
          mediaId: im.mediaId ?? '',
        })),
    };

    const highlightItems = highlights
      .filter((h) => !!h.mediaId && !!h.url)
      .map((h) => ({
        id: h.id,
        mediaId: h.mediaId as string,
        url: h.url,
        alt: h.alt,
        sortOrder: h.sortOrder,
      }));

    const hasJourney =
      !!journeyPayload.video || journeyPayload.images.length > 0;

    return batch$.pipe(
      switchMap(() => {
        const productOps = batch.products.map((p) => this.persistProduct(batchId, p));
        return productOps.length ? forkJoin(productOps) : of([]);
      }),
      switchMap(() =>
        hasJourney ? this.api.putJourney(batchId, journeyPayload) : of(null),
      ),
      switchMap(() =>
        highlightItems.length || this.knownBatchIds.has(batchId)
          ? this.api.putHeroHighlights(batchId, highlightItems)
          : of(null),
      ),
      switchMap(() => {
        if (db.site.activeBatchId === batchId) {
          return this.api.putActiveBatch(batchId);
        }
        return of(null);
      }),
      tap(() => {
        this.dirty.set(false);
        this.saving.set(false);
      }),
      catchError((err) => {
        this.saving.set(false);
        return throwError(() => err);
      }),
    );
  }

  deleteBatchRemote(batchId: string): Observable<unknown> {
    return this.api.deleteBatch(batchId).pipe(
      tap(() => {
        this.knownBatchIds.delete(batchId);
        this.deleteBatch(batchId);
        this.dirty.set(false);
      }),
    );
  }

  persistProduct(batchId: string, product: ProductRow): Observable<ProductRow> {
    const body = {
      batchId,
      name: product.name,
      price: product.price,
      description: product.description,
      summary: product.summary,
      dimensions: product.dimensions,
      alt: product.alt,
      soldOut: product.soldOut,
      sortOrder: product.sortOrder,
      colors: product.colors,
      images: product.images.map((img) => ({
        id: img.id,
        url: img.url,
        sortOrder: img.sortOrder,
        mediaId: img.mediaId,
      })),
    };

    const missingMedia = body.images.filter((i) => !i.mediaId || !i.url);
    if (missingMedia.length) {
      return throwError(
        () =>
          new Error(
            `Product "${product.name}" has images without mediaId. Re-upload images after connecting to the API.`,
          ),
      );
    }

    if (this.knownProductIds.has(product.id)) {
      return this.api.updateProduct(product.id, body);
    }
    return this.api.createProduct({ ...body, id: product.id }).pipe(
      tap((p) => this.knownProductIds.add(p.id)),
    );
  }

  deleteProductRemote(batchId: string, productId: string): Observable<unknown> {
    if (!this.knownProductIds.has(productId)) {
      this.deleteProduct(batchId, productId);
      return of({ deleted: true });
    }
    return this.api.deleteProduct(productId).pipe(
      tap(() => {
        this.knownProductIds.delete(productId);
        this.deleteProduct(batchId, productId);
      }),
    );
  }

  saveAbout(): Observable<unknown> {
    const db = this.db();
    if (!db) {
      return throwError(() => new Error('Not loaded'));
    }
    this.saving.set(true);
    const about = db.pageCopy.about;
    return this.api
      .putPage('about', {
        eyebrow: about.eyebrow,
        heading: about.heading,
        image: about.image,
        imageAlt: about.imageAlt,
        reviewsEyebrow: about.reviewsEyebrow,
        reviewsHeading: about.reviewsHeading,
        paragraphs: about.paragraphs,
      })
      .pipe(
        switchMap(() => {
          const ops = about.reviews.map((r) => this.persistReview(r));
          return ops.length ? forkJoin(ops) : of([]);
        }),
        tap(() => {
          this.dirty.set(false);
          this.saving.set(false);
        }),
        catchError((err) => {
          this.saving.set(false);
          return throwError(() => err);
        }),
      );
  }

  persistReview(review: AboutReview): Observable<AboutReview> {
    const body: Partial<AboutReview> & { isPublished?: boolean; sortOrder?: number } = {
      quote: review.quote,
      name: review.name,
      detail: review.detail,
      rating: review.rating,
      gender: review.gender,
      image: review.image || undefined,
      imageAlt: review.imageAlt || undefined,
      isPublished: true,
      sortOrder: 0,
    };
    if (this.knownReviewIds.has(review.id)) {
      return this.api.updateReview(review.id, body);
    }
    return this.api.createReview({ ...body, id: review.id }).pipe(
      tap((r) => this.knownReviewIds.add(r.id)),
    );
  }

  deleteReviewRemote(id: string): Observable<unknown> {
    if (!this.knownReviewIds.has(id)) {
      this.deleteReview(id);
      return of({ deleted: true });
    }
    return this.api.deleteReview(id).pipe(
      tap(() => {
        this.knownReviewIds.delete(id);
        this.deleteReview(id);
      }),
    );
  }

  savePageSection(
    section: 'hero' | 'collections' | 'journey' | 'batch-shop',
  ): Observable<unknown> {
    const db = this.db();
    if (!db) {
      return throwError(() => new Error('Not loaded'));
    }
    this.saving.set(true);
    const body =
      section === 'hero'
        ? db.pageCopy.hero
        : section === 'collections'
          ? db.pageCopy.collections
          : section === 'journey'
            ? db.pageCopy.journey
            : db.pageCopy.batchShop;

    return this.api.putPage(section, body).pipe(
      tap(() => {
        this.dirty.set(false);
        this.saving.set(false);
      }),
      catchError((err) => {
        this.saving.set(false);
        return throwError(() => err);
      }),
    );
  }

  listLeads(): Observable<unknown[]> {
    return this.api.listLeads();
  }

  // —— in-memory mutators (UI) ——

  updateSite(patch: Partial<SiteContentDb['site']>): void {
    this.patchDb((db) => {
      db.site = { ...db.site, ...patch };
    });
  }

  updateContact(patch: Partial<SiteContentDb['contact']>): void {
    this.patchDb((db) => {
      db.contact = { ...db.contact, ...patch };
    });
  }

  setVisitLines(lines: string[]): void {
    this.patchDb((db) => {
      db.contact.visitLines = lines.filter((l) => l.trim().length > 0);
    });
  }

  setNavLinks(links: NavLinkRow[]): void {
    this.patchDb((db) => {
      db.navLinks = links;
    });
  }

  upsertBatch(batch: BatchRow): void {
    this.patchDb((db) => {
      const i = db.batches.findIndex((b) => b.id === batch.id);
      if (i >= 0) {
        db.batches[i] = batch;
      } else {
        db.batches.push(batch);
      }
      db.batches.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  deleteBatch(batchId: string): void {
    this.patchDb((db) => {
      db.batches = db.batches.filter((b) => b.id !== batchId);
      if (db.site.activeBatchId === batchId) {
        db.site.activeBatchId = db.batches[0]?.id ?? '';
      }
      db.journeyVideos = db.journeyVideos.filter((v) => v.batchId !== batchId);
      db.journeyImages = (db.journeyImages ?? []).filter((v) => v.batchId !== batchId);
      db.heroHighlightImages = (db.heroHighlightImages ?? []).filter((v) => v.batchId !== batchId);
    });
  }

  createEmptyBatch(): BatchRow {
    const savedBatches = (this.db()?.batches ?? [])
      .filter((batch) => this.knownBatchIds.has(batch.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const lastBatch = savedBatches[savedBatches.length - 1];
    const lastNumber = lastBatch?.label.match(/(?:batch[-\s#]*)?(\d+)$/i)?.[1];
    const n = lastNumber ? Number(lastNumber) + 1 : 1;
    const sortOrder = (lastBatch?.sortOrder ?? 0) + 1;
    const id = newId('batch');
    const launch = new Date(Date.now() + 7 * 864e5);
    launch.setSeconds(0, 0);
    return {
      id,
      label: `Batch-${String(n).padStart(3, '0')}`,
      launchAt: launch.toISOString(),
      launchDisplay: launch.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      soldOut: false,
      sortOrder,
      heroWindowDays: 10,
      countdownEyebrow: 'Next drop',
      countdownHeading: 'New firing opens soon',
      countdownLede: 'Countdown ends at launch — then photos and WhatsApp orders go live.',
      celebrationHeading: 'This batch is live',
      celebrationLede: 'The drop is open. Explore each piece.',
      products: [],
    };
  }

  /** Persist a new batch shell to MySQL, then keep it in the local store. */
  createBatchRemote(draft: BatchRow): Observable<BatchRow> {
    if (!this.db()) {
      return throwError(() => new Error('Admin data not loaded. Is orbit-api running?'));
    }
    this.saving.set(true);
    const body = {
      id: draft.id,
      label: draft.label,
      launchAt: draft.launchAt,
      launchDisplay: draft.launchDisplay,
      soldOut: draft.soldOut,
      sortOrder: draft.sortOrder,
      heroWindowDays: draft.heroWindowDays ?? 10,
      countdownEyebrow: draft.countdownEyebrow,
      countdownHeading: draft.countdownHeading,
      countdownLede: draft.countdownLede,
      celebrationHeading: draft.celebrationHeading,
      celebrationLede: draft.celebrationLede,
    };
    return this.api.createBatch(body).pipe(
      map((created) => {
        const row: BatchRow = {
          ...draft,
          id: created.id || draft.id,
          label: created.label ?? draft.label,
          launchAt: created.launchAt ?? draft.launchAt,
          launchDisplay: created.launchDisplay ?? draft.launchDisplay,
          soldOut: created.soldOut ?? draft.soldOut,
          sortOrder: created.sortOrder ?? draft.sortOrder,
          heroWindowDays: created.heroWindowDays ?? draft.heroWindowDays,
          countdownEyebrow: created.countdownEyebrow ?? draft.countdownEyebrow,
          countdownHeading: created.countdownHeading ?? draft.countdownHeading,
          countdownLede: created.countdownLede ?? draft.countdownLede,
          celebrationHeading: created.celebrationHeading ?? draft.celebrationHeading,
          celebrationLede: created.celebrationLede ?? draft.celebrationLede,
          products: Array.isArray(created.products) ? created.products : [],
        };
        this.knownBatchIds.add(row.id);
        this.upsertBatch(row);
        this.dirty.set(false);
        this.saving.set(false);
        return row;
      }),
      catchError((err) => {
        this.saving.set(false);
        return throwError(() => err);
      }),
    );
  }

  isBatchPersisted(batchId: string): boolean {
    return this.knownBatchIds.has(batchId);
  }

  createEmptyProduct(batchId: string): ProductRow {
    const batch = this.db()?.batches.find((b) => b.id === batchId);
    const sort = (batch?.products.length ?? 0) + 1;
    return {
      id: newId('product'),
      name: 'New piece',
      price: 0,
      description: '',
      summary: '',
      dimensions: '',
      alt: '',
      sortOrder: sort,
      soldOut: false,
      colors: [],
      images: [],
    };
  }

  upsertProduct(batchId: string, product: ProductRow): void {
    this.patchDb((db) => {
      const batch = db.batches.find((b) => b.id === batchId);
      if (!batch) {
        return;
      }
      const i = batch.products.findIndex((p) => p.id === product.id);
      if (i >= 0) {
        batch.products[i] = product;
      } else {
        batch.products.push(product);
      }
      batch.products.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  deleteProduct(batchId: string, productId: string): void {
    this.patchDb((db) => {
      const batch = db.batches.find((b) => b.id === batchId);
      if (!batch) {
        return;
      }
      batch.products = batch.products.filter((p) => p.id !== productId);
    });
  }

  updatePageHero(patch: Partial<SiteContentDb['pageCopy']['hero']>): void {
    this.patchDb((db) => {
      db.pageCopy.hero = { ...db.pageCopy.hero, ...patch };
    });
  }

  setHeroHighlights(rows: HeroHighlightImageRow[]): void {
    this.patchDb((db) => {
      db.heroHighlightImages = rows;
    });
  }

  addHeroHighlight(row: Omit<HeroHighlightImageRow, 'id'> & { id?: string }): void {
    this.patchDb((db) => {
      const list = db.heroHighlightImages ?? [];
      list.push({ ...row, id: row.id ?? newId('hh') });
      db.heroHighlightImages = list.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  updateHeroHighlight(id: string, patch: Partial<HeroHighlightImageRow>): void {
    this.patchDb((db) => {
      const list = db.heroHighlightImages ?? [];
      const i = list.findIndex((r) => r.id === id);
      if (i < 0) {
        return;
      }
      list[i] = { ...list[i], ...patch };
      db.heroHighlightImages = list;
    });
  }

  removeHeroHighlight(id: string): void {
    this.patchDb((db) => {
      db.heroHighlightImages = (db.heroHighlightImages ?? []).filter((r) => r.id !== id);
    });
  }

  upsertJourneyVideoForBatch(
    batchId: string,
    patch: Partial<Omit<JourneyVideoRow, 'batchId'>> & { id?: string },
  ): void {
    this.patchDb((db) => {
      const others = db.journeyVideos.filter((v) => v.batchId !== batchId);
      const existing = db.journeyVideos.find((v) => v.batchId === batchId);
      const next: JourneyVideoRow = {
        id: patch.id ?? existing?.id ?? newId('jv'),
        batchId,
        title: patch.title ?? existing?.title ?? 'Process film',
        lede: patch.lede ?? existing?.lede ?? '',
        posterImage: patch.posterImage ?? existing?.posterImage ?? '',
        videoUrl: patch.videoUrl ?? existing?.videoUrl ?? '',
        sortOrder: 1,
        posterMediaId: patch.posterMediaId ?? existing?.posterMediaId,
        videoMediaId: patch.videoMediaId ?? existing?.videoMediaId,
      };
      db.journeyVideos = [...others, next];
    });
  }

  clearJourneyVideoForBatch(batchId: string): void {
    this.patchDb((db) => {
      db.journeyVideos = db.journeyVideos.filter((v) => v.batchId !== batchId);
    });
  }

  setJourneyVideos(rows: JourneyVideoRow[]): void {
    this.patchDb((db) => {
      db.journeyVideos = rows;
    });
  }

  addJourneyImage(row: Omit<JourneyImageRow, 'id'> & { id?: string }): void {
    this.patchDb((db) => {
      const list = db.journeyImages ?? [];
      list.push({ ...row, id: row.id ?? newId('ji') });
      db.journeyImages = list.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  updateJourneyImage(id: string, patch: Partial<JourneyImageRow>): void {
    this.patchDb((db) => {
      const list = db.journeyImages ?? [];
      const i = list.findIndex((r) => r.id === id);
      if (i < 0) {
        return;
      }
      list[i] = { ...list[i], ...patch };
      db.journeyImages = list;
    });
  }

  removeJourneyImage(id: string): void {
    this.patchDb((db) => {
      db.journeyImages = (db.journeyImages ?? []).filter((v) => v.id !== id);
    });
  }

  setJourneyImages(rows: JourneyImageRow[]): void {
    this.patchDb((db) => {
      db.journeyImages = rows;
    });
  }

  updateAbout(patch: Partial<SiteContentDb['pageCopy']['about']>): void {
    this.patchDb((db) => {
      db.pageCopy.about = { ...db.pageCopy.about, ...patch };
    });
  }

  setAboutParagraphs(paragraphs: string[]): void {
    this.patchDb((db) => {
      db.pageCopy.about.paragraphs = paragraphs;
    });
  }

  upsertReview(review: AboutReview): void {
    this.patchDb((db) => {
      const list = db.pageCopy.about.reviews;
      const i = list.findIndex((r) => r.id === review.id);
      if (i >= 0) {
        list[i] = review;
      } else {
        list.push(review);
      }
    });
  }

  deleteReview(id: string): void {
    this.patchDb((db) => {
      db.pageCopy.about.reviews = db.pageCopy.about.reviews.filter((r) => r.id !== id);
    });
  }

  createEmptyReview(): AboutReview {
    return {
      id: newId('review'),
      quote: '',
      name: '',
      detail: '',
      rating: 5,
      gender: 'woman',
      image: '',
      imageAlt: '',
    };
  }

  updateCollections(patch: Partial<SiteContentDb['pageCopy']['collections']>): void {
    this.patchDb((db) => {
      db.pageCopy.collections = { ...db.pageCopy.collections, ...patch };
    });
  }

  updateJourneyPage(patch: Partial<SiteContentDb['pageCopy']['journey']>): void {
    this.patchDb((db) => {
      db.pageCopy.journey = { ...db.pageCopy.journey, ...patch };
    });
  }

  updateBatchShop(patch: Partial<SiteContentDb['pageCopy']['batchShop']>): void {
    this.patchDb((db) => {
      db.pageCopy.batchShop = { ...db.pageCopy.batchShop, ...patch };
    });
  }

  updateFooter(patch: Partial<SiteContentDb['pageCopy']['footer']>): void {
    this.patchDb((db) => {
      db.pageCopy.footer = { ...db.pageCopy.footer, ...patch };
    });
  }

  private assembleDb(
    bootstrap: {
      version: number;
      site: SiteContentDb['site'];
      contact: ContactInfo | null;
      batches: BatchRow[];
      journeyVideos: JourneyVideoRow[];
      journeyImages: JourneyImageRow[];
      heroHighlightImages: HeroHighlightImageRow[];
      pageCopy: Record<string, unknown>;
    },
    chrome: { navLinks?: unknown; pageCopy?: { footer?: unknown } },
    reviews: AboutReview[],
  ): SiteContentDb {
    const pc = bootstrap.pageCopy ?? {};
    const aboutRaw = (pc['about'] as SiteContentDb['pageCopy']['about']) ?? {
      eyebrow: '',
      heading: '',
      paragraphs: [],
      image: '',
      imageAlt: '',
      reviewsEyebrow: '',
      reviewsHeading: '',
      reviews: [],
    };

    const mappedReviews: AboutReview[] =
      reviews.length > 0
        ? reviews.map((r) => ({
            id: r.id,
            quote: r.quote,
            name: r.name,
            detail: r.detail,
            rating: r.rating,
            gender: r.gender,
            image: r.image ?? '',
            imageAlt: r.imageAlt ?? '',
          }))
        : aboutRaw.reviews ?? [];

    const contact: ContactInfo = bootstrap.contact ?? {
      id: 'contact-main',
      siteId: bootstrap.site.id,
      whatsapp: '',
      email: '',
      instagram: '',
      instagramHandle: '',
      visitLines: [],
    };

    const footer =
      (chrome.pageCopy?.footer as FooterContent | undefined) ?? emptyFooter();

    return {
      version: bootstrap.version ?? 1,
      site: {
        id: bootstrap.site.id,
        brand: bootstrap.site.brand,
        activeBatchId: bootstrap.site.activeBatchId ?? '',
      },
      contact,
      navLinks: (chrome.navLinks as NavLinkRow[]) ?? [],
      batches: bootstrap.batches ?? [],
      journeyVideos: bootstrap.journeyVideos ?? [],
      journeyImages: bootstrap.journeyImages ?? [],
      heroHighlightImages: bootstrap.heroHighlightImages ?? [],
      pageCopy: {
        hero: (pc['hero'] as SiteContentDb['pageCopy']['hero']) ?? {
          image: '',
          brand: bootstrap.site.brand,
          brandPrimary: 'Orbit',
          brandSecondary: 'Ceramic',
          title: '',
          lede: '',
          ctaLabel: '',
          ctaHref: '/batch',
        },
        about: { ...aboutRaw, reviews: mappedReviews },
        collections: (pc['collections'] as SiteContentDb['pageCopy']['collections']) ?? {
          eyebrow: '',
          heading: '',
          lede: '',
          outOfStockLabel: 'Out of stock',
          customNote: '',
          customCtaLabel: '',
          viewByBatchLabel: 'By batch',
          viewAllLabel: 'View all',
          emptyTitle: '',
          emptyLede: '',
          emptyCtaLabel: '',
        },
        journey: (pc['journey'] as SiteContentDb['pageCopy']['journey']) ?? {
          eyebrow: '',
          heading: '',
          lede: '',
          openLabel: '',
          backLabel: '',
          emptyTitle: '',
          emptyLede: '',
          emptyCtaLabel: '',
        },
        batchShop: (pc['batchShop'] as SiteContentDb['pageCopy']['batchShop']) ?? {
          eyebrow: '',
          heading: '',
          lede: '',
          buyLabel: 'Buy on WhatsApp',
          currency: 'PKR',
          currencySymbol: 'Rs',
        },
        footer,
      },
    };
  }

  private syncKnownIds(db: SiteContentDb): void {
    this.knownBatchIds = new Set(db.batches.map((b) => b.id));
    this.knownProductIds = new Set(db.batches.flatMap((b) => b.products.map((p) => p.id)));
    this.knownReviewIds = new Set(db.pageCopy.about.reviews.map((r) => r.id));
  }

  private patchDb(mutate: (db: SiteContentDb) => void): void {
    const current = this.db();
    if (!current) {
      return;
    }
    const next = cloneDb(current);
    mutate(next);
    this.db.set(next);
    this.dirty.set(true);
  }
}

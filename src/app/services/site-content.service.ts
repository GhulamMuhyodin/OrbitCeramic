import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay } from 'rxjs';
import {
  FooterContent,
  NavLinkRow,
  SiteContent,
  SiteContentDb,
  assembleSiteContent,
} from '../data/site-content.model';
import { API_CONFIG } from '../config/api.config';
import { BootstrapPayload } from '../admin/admin-api.service';

const CHROME_PATH = '/data/site-content.json';

@Injectable({ providedIn: 'root' })
export class SiteContentService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  /** Loads catalog from API bootstrap + static nav/footer from JSON. */
  private readonly content$ = this.createContent$();

  load(): Observable<SiteContent> {
    return this.content$;
  }

  loadFresh(): Observable<SiteContent> {
    return this.fetchDb().pipe(map((db) => assembleSiteContent(db)));
  }

  private createContent$(): Observable<SiteContent> {
    return this.fetchDb().pipe(
      map((db) => assembleSiteContent(db)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  private fetchDb(): Observable<SiteContentDb> {
    return forkJoin({
      bootstrap: this.http.get<BootstrapPayload>(`${API_CONFIG.apiBase}/bootstrap`, {
        transferCache: false,
        cache: 'no-store',
      }),
      chrome: this.http
        .get<{
          navLinks?: NavLinkRow[];
          pageCopy?: { footer?: FooterContent };
        }>(this.chromeUrl(), { transferCache: false, cache: 'no-store' })
        .pipe(
          catchError(() =>
            of({
              navLinks: [] as NavLinkRow[],
              pageCopy: { footer: undefined as FooterContent | undefined },
            }),
          ),
        ),
    }).pipe(map(({ bootstrap, chrome }) => this.mergeBootstrap(bootstrap, chrome)));
  }

  private mergeBootstrap(
    bootstrap: BootstrapPayload,
    chrome: { navLinks?: NavLinkRow[]; pageCopy?: { footer?: FooterContent } },
  ): SiteContentDb {
    const pc = bootstrap.pageCopy ?? {};
    const footer: FooterContent = chrome.pageCopy?.footer ?? {
      tagline: '',
      visitLabel: 'Visit',
      exploreLabel: 'Explore',
      followLabel: 'Follow',
      exploreLinks: [],
      socialLinks: [],
      copyright: '',
    };

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
    const about: SiteContentDb['pageCopy']['about'] = {
      ...aboutRaw,
      reviews: aboutRaw.reviews ?? [],
    };

    return {
      version: bootstrap.version ?? 1,
      site: {
        id: bootstrap.site.id,
        brand: bootstrap.site.brand,
        image: bootstrap.site.image ?? '',
        imageMediaId: bootstrap.site.imageMediaId ?? undefined,
        activeBatchId: bootstrap.site.activeBatchId ?? '',
      },
      contact: bootstrap.contact ?? {
        id: 'contact-main',
        siteId: bootstrap.site.id,
        whatsapp: '',
        email: '',
        instagram: '',
        instagramHandle: '',
        lineText: '',
      },
      navLinks: chrome.navLinks ?? [],
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
        about,
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

  private chromeUrl(): string {
    if (isPlatformBrowser(this.platformId)) {
      return `${CHROME_PATH}?t=${Date.now()}`;
    }
    return CHROME_PATH;
  }
}

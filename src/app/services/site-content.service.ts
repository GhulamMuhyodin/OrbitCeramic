import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { SiteContent, SiteContentDb, assembleSiteContent } from '../data/site-content.model';

const CONTENT_PATH = '/data/site-content.json';

@Injectable({ providedIn: 'root' })
export class SiteContentService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Loads relational JSON at runtime (not baked into the JS bundle).
   * Browser requests always bypass HTTP/transfer cache so editing
   * `data/site-content.json` on the server after deploy shows up on refresh.
   */
  private readonly content$ = this.createContent$();

  load(): Observable<SiteContent> {
    return this.content$;
  }

  private createContent$(): Observable<SiteContent> {
    return this.http
      .get<SiteContentDb>(this.contentUrl(), {
        // Never reuse SSR/prerender transfer cache — always hit the live JSON file.
        transferCache: false,
        // Bypass browser HTTP cache (Fetch API).
        cache: 'no-store',
      })
      .pipe(
        map((db) => assembleSiteContent(db)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
  }

  private contentUrl(): string {
    // Extra query bust for proxies/CDNs that ignore Cache-Control.
    if (isPlatformBrowser(this.platformId)) {
      return `${CONTENT_PATH}?t=${Date.now()}`;
    }
    return CONTENT_PATH;
  }
}

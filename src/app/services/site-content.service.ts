import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { SiteContent, SiteContentDb, assembleSiteContent } from '../data/site-content.model';

const CONTENT_PATH = '/data/site-content.json';

@Injectable({ providedIn: 'root' })
export class SiteContentService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Loads relational JSON tables, then assembles UI view models.
   * Cache-busted in the browser so post-deploy JSON edits apply on refresh.
   */
  private readonly content$ = this.http
    .get<SiteContentDb>(this.contentUrl(), {
      headers: new HttpHeaders({
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      }),
    })
    .pipe(
      map((db) => assembleSiteContent(db)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

  load(): Observable<SiteContent> {
    return this.content$;
  }

  private contentUrl(): string {
    if (isPlatformBrowser(this.platformId)) {
      return `${CONTENT_PATH}?t=${Date.now()}`;
    }
    return CONTENT_PATH;
  }
}

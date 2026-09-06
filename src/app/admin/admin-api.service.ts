import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import {
  AboutContent,
  AboutReview,
  BatchRow,
  ContactInfo,
  HeroContent,
  JourneyImageRow,
  JourneyVideoRow,
  ProductRow,
  SiteRow,
} from '../data/site-content.model';

export interface MediaUploadResult {
  id: string;
  siteId: string;
  publicUrl: string;
  mime: string;
  bytes: number;
  originalName: string;
  kind: string;
}

export interface BootstrapPayload {
  version: number;
  serverTime?: string;
  site: SiteRow;
  contact: ContactInfo | null;
  batches: BatchRow[];
  journeyVideos: JourneyVideoRow[];
  journeyImages: JourneyImageRow[];
  heroHighlightImages: Array<{
    id: string;
    batchId: string;
    url: string;
    alt: string;
    sortOrder: number;
    mediaId?: string;
  }>;
  pageCopy: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = API_CONFIG.apiBase;

  login(apiKey: string): Observable<{ token: string; tokenType: string }> {
    return this.http.post<{ token: string; tokenType: string }>(`${this.base}/admin/auth/login`, {
      apiKey,
    });
  }

  getBootstrap(): Observable<BootstrapPayload> {
    return this.http.get<BootstrapPayload>(`${this.base}/bootstrap`);
  }

  getChromeJson(): Observable<{
    navLinks: unknown[];
    pageCopy?: { footer?: unknown };
  }> {
    return this.http.get<{ navLinks: unknown[]; pageCopy?: { footer?: unknown } }>(
      '/data/site-content.json',
    );
  }

  getSite(): Observable<SiteRow> {
    return this.http.get<SiteRow>(`${this.base}/admin/site`);
  }

  putSite(body: {
    id?: string;
    brand: string;
    activeBatchId?: string | null;
    image?: string;
    imageMediaId?: string;
  }): Observable<SiteRow> {
    return this.http.put<SiteRow>(`${this.base}/admin/site`, body);
  }

  putActiveBatch(activeBatchId: string | null): Observable<SiteRow> {
    return this.http.put<SiteRow>(`${this.base}/admin/sites/active-batch`, { activeBatchId });
  }

  getContact(): Observable<ContactInfo> {
    return this.http.get<ContactInfo>(`${this.base}/admin/contact`);
  }

  putContact(body: Partial<ContactInfo>): Observable<ContactInfo> {
    return this.http.put<ContactInfo>(`${this.base}/admin/contact`, body);
  }

  listBatches(): Observable<BatchRow[]> {
    return this.http
      .get<{ items: BatchRow[] }>(`${this.base}/admin/batches`)
      .pipe(map((r) => r.items ?? []));
  }

  getBatch(id: string): Observable<BatchRow> {
    return this.http.get<BatchRow>(`${this.base}/admin/batches/${encodeURIComponent(id)}`);
  }

  createBatch(body: Partial<BatchRow>): Observable<BatchRow> {
    return this.http.post<BatchRow>(`${this.base}/admin/batches`, body);
  }

  updateBatch(id: string, body: Partial<BatchRow>): Observable<BatchRow> {
    return this.http.put<BatchRow>(`${this.base}/admin/batches/${encodeURIComponent(id)}`, body);
  }

  deleteBatch(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/admin/batches/${encodeURIComponent(id)}`,
    );
  }

  saveBatch(
    batchId: string,
    body:
      | FormData
      | {
          batch: Partial<BatchRow>;
          products?: Array<Partial<ProductRow> & { batchId?: string }>;
          journey?: { video?: Partial<JourneyVideoRow> | null; images?: JourneyImageRow[] };
          highlights?: Array<{
            id?: string;
            mediaId?: string;
            url?: string;
            alt?: string;
            sortOrder?: number;
            fileKey?: string;
          }>;
        },
  ): Observable<BatchRow> {
    return this.http.put<BatchRow>(
      `${this.base}/admin/batches/${encodeURIComponent(batchId)}/transaction`,
      body,
    );
  }

  putJourney(
    batchId: string,
    body: {
      video?: Partial<JourneyVideoRow> | null;
      images?: JourneyImageRow[];
    },
  ): Observable<unknown> {
    return this.http.put(
      `${this.base}/admin/batches/${encodeURIComponent(batchId)}/journey`,
      body,
    );
  }

  putHeroHighlights(
    batchId: string,
    items: Array<{
      id?: string;
      mediaId: string;
      url: string;
      alt: string;
      sortOrder?: number;
    }>,
  ): Observable<unknown> {
    return this.http.put(
      `${this.base}/admin/batches/${encodeURIComponent(batchId)}/hero-highlights`,
      { items },
    );
  }

  listProducts(batchId?: string): Observable<ProductRow[]> {
    const q = batchId ? `?batchId=${encodeURIComponent(batchId)}` : '';
    return this.http
      .get<{ items: ProductRow[] }>(`${this.base}/admin/products${q}`)
      .pipe(map((r) => r.items ?? []));
  }

  createProduct(body: Partial<ProductRow> & { batchId: string }): Observable<ProductRow> {
    return this.http.post<ProductRow>(`${this.base}/admin/products`, body);
  }

  updateProduct(id: string, body: Partial<ProductRow> & { batchId?: string }): Observable<ProductRow> {
    return this.http.put<ProductRow>(
      `${this.base}/admin/products/${encodeURIComponent(id)}`,
      body,
    );
  }

  deleteProduct(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/admin/products/${encodeURIComponent(id)}`,
    );
  }

  getPage<T>(section: string): Observable<T> {
    return this.http.get<T>(`${this.base}/admin/page/${encodeURIComponent(section)}`);
  }

  putPage<T>(section: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}/admin/page/${encodeURIComponent(section)}`, body);
  }

  listReviews(): Observable<AboutReview[]> {
    return this.http
      .get<{ items: AboutReview[] }>(`${this.base}/admin/reviews`)
      .pipe(map((r) => r.items ?? []));
  }

  createReview(body: Partial<AboutReview>): Observable<AboutReview> {
    return this.http.post<AboutReview>(`${this.base}/admin/reviews`, body);
  }

  updateReview(id: string, body: Partial<AboutReview>): Observable<AboutReview> {
    return this.http.put<AboutReview>(
      `${this.base}/admin/reviews/${encodeURIComponent(id)}`,
      body,
    );
  }

  // removed: putReviewMetadata endpoint deleted server-side

  deleteReview(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/admin/reviews/${encodeURIComponent(id)}`,
    );
  }

  listLeads(status?: string): Observable<unknown[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.http
      .get<{ items: unknown[] }>(`${this.base}/admin/leads${q}`)
      .pipe(map((r) => r.items ?? []));
  }

  uploadMedia(file: File, siteId: string = API_CONFIG.defaultSiteId): Observable<MediaUploadResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('siteId', siteId);
    return this.http.post<MediaUploadResult>(`${this.base}/admin/media`, form);
  }
}

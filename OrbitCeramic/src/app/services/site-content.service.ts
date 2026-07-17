import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { SiteContent } from '../data/site-content.model';

@Injectable({ providedIn: 'root' })
export class SiteContentService {
  private readonly http = inject(HttpClient);
  private readonly content$ = this.http
    .get<SiteContent>('/data/site-content.json')
    .pipe(shareReplay(1));

  load(): Observable<SiteContent> {
    return this.content$;
  }
}

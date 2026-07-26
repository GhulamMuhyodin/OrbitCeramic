import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Collections } from '../../components/collections/collections';
import { SiteFooter } from '../../components/site-footer/site-footer';
import { SiteHeader } from '../../components/site-header/site-header';
import { SiteContentService } from '../../services/site-content.service';

@Component({
  selector: 'app-collections-page',
  imports: [AsyncPipe, SiteHeader, Collections, SiteFooter],
  host: { class: 'block' },
  templateUrl: './collections-page.html',
})
export class CollectionsPage {
  private readonly contentService = inject(SiteContentService);
  protected readonly content$ = this.contentService.load();
}

import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Batch } from '../../components/batch/batch';
import { SiteFooter } from '../../components/site-footer/site-footer';
import { SiteHeader } from '../../components/site-header/site-header';
import { SiteContentService } from '../../services/site-content.service';

@Component({
  selector: 'app-batch-page',
  imports: [AsyncPipe, SiteHeader, Batch, SiteFooter],
  host: { class: 'block' },
  templateUrl: './batch-page.html',
})
export class BatchPage {
  private readonly contentService = inject(SiteContentService);
  protected readonly content$ = this.contentService.load();
}

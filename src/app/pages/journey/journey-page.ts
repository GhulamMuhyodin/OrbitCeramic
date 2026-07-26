import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Journey } from '../../components/journey/journey';
import { SiteFooter } from '../../components/site-footer/site-footer';
import { SiteHeader } from '../../components/site-header/site-header';
import { SiteContentService } from '../../services/site-content.service';

@Component({
  selector: 'app-journey-page',
  imports: [AsyncPipe, SiteHeader, Journey, SiteFooter],
  host: { class: 'block' },
  templateUrl: './journey-page.html',
})
export class JourneyPage {
  private readonly contentService = inject(SiteContentService);
  protected readonly content$ = this.contentService.load();
}

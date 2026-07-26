import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { About } from '../../components/about/about';
import { SiteFooter } from '../../components/site-footer/site-footer';
import { SiteHeader } from '../../components/site-header/site-header';
import { SiteContentService } from '../../services/site-content.service';

@Component({
  selector: 'app-about-page',
  imports: [AsyncPipe, SiteHeader, About, SiteFooter],
  host: { class: 'block' },
  templateUrl: './about-page.html',
})
export class AboutPage {
  private readonly contentService = inject(SiteContentService);
  protected readonly content$ = this.contentService.load();
}

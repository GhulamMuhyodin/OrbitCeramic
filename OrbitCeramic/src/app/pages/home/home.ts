import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { About } from '../../components/about/about';
import { Bestsellers } from '../../components/bestsellers/bestsellers';
import { Collections } from '../../components/collections/collections';
import { Hero } from '../../components/hero/hero';
import { SiteFooter } from '../../components/site-footer/site-footer';
import { SiteHeader } from '../../components/site-header/site-header';
import { VideoBlock } from '../../components/video-block/video-block';
import { SiteContentService } from '../../services/site-content.service';

@Component({
  selector: 'app-home',
  imports: [
    AsyncPipe,
    SiteHeader,
    Hero,
    About,
    Collections,
    VideoBlock,
    Bestsellers,
    SiteFooter,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomePage {
  private readonly contentService = inject(SiteContentService);
  protected readonly content$ = this.contentService.load();
}

import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  PLATFORM_ID,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import PhotoSwipe from 'photoswipe';
import { RevealDirective } from '../../directives/reveal';
import {
  JourneyBatchCard,
  JourneyPageCopy,
  JourneyVideoRow,
} from '../../data/site-content.model';

@Component({
  selector: 'app-journey',
  imports: [RevealDirective, RouterLink],
  host: { class: 'block' },
  templateUrl: './journey.html',
})
export class Journey {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);

  readonly content = input.required<JourneyPageCopy>();
  readonly cards = input.required<JourneyBatchCard[]>();

  protected readonly activeCard = signal<JourneyBatchCard | null>(null);
  protected readonly playingVideoId = signal<string | null>(null);
  protected readonly playingEmbedUrl = signal<SafeResourceUrl | null>(null);

  protected readonly isEmpty = computed(() => this.cards().length === 0);

  protected openCard(card: JourneyBatchCard): void {
    this.activeCard.set(card);
    this.stopVideo();
  }

  protected backToCards(): void {
    this.activeCard.set(null);
    this.stopVideo();
  }

  protected play(video: JourneyVideoRow): void {
    this.playingVideoId.set(video.id);
    this.playingEmbedUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(video.videoUrl),
    );
  }

  protected isPlaying(videoId: string): boolean {
    return this.playingVideoId() === videoId;
  }

  /** Fullscreen gallery + pinch/zoom via PhotoSwipe. */
  protected async openViewer(index: number): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const images = this.activeCard()?.images ?? [];
    if (!images.length) {
      return;
    }

    const dataSource = await Promise.all(
      images.map(async (image) => {
        const size = await this.readImageSize(image.url);
        return {
          src: image.url,
          width: size.width,
          height: size.height,
          alt: image.alt,
        };
      }),
    );

    const gallery = new PhotoSwipe({
      dataSource,
      index,
      showHideAnimationType: 'fade',
      bgOpacity: 0.92,
      wheelToZoom: true,
      // Start fitted; clicks step up instead of jumping to a large zoom.
      initialZoomLevel: 'fit',
      secondaryZoomLevel: (level) => level.fit * 1.25,
      maxZoomLevel: (level) => level.fit * 2.5,
      padding: { top: 24, bottom: 24, left: 16, right: 16 },
      zoom: false,
    });

    gallery.on('uiRegister', () => {
      gallery.ui?.registerElement({
        name: 'step-zoom',
        order: 9,
        isButton: true,
        title: 'Zoom',
        className: 'pswp__button--zoom',
        html: {
          isCustomSVG: true,
          inner:
            '<path d="M17.426 19.926a6 6 0 1 1 1.5-1.5L23 22.5 21.5 24l-4.074-4.074z" id="pswp__icn-zoom"/>' +
            '<path fill="currentColor" class="pswp__zoom-icn-bar-h" d="M11 16v-2h6v2z"/>' +
            '<path fill="currentColor" class="pswp__zoom-icn-bar-v" d="M13 12h2v6h-2z"/>',
          outlineID: 'pswp__icn-zoom',
        },
        onClick: (_event, _el, pswp) => {
          const slide = pswp.currSlide;
          if (!slide) {
            return;
          }

          const fit = slide.zoomLevels.fit;
          const max = slide.zoomLevels.max;
          const step = fit * 0.35;
          const current = slide.currZoomLevel;
          const next =
            current >= max - 0.01 ? fit : Math.min(max, current + step);

          slide.zoomTo(
            next,
            { x: pswp.viewportSize.x / 2, y: pswp.viewportSize.y / 2 },
            200,
          );
        },
      });
    });

    gallery.init();
  }

  private readImageSize(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth || 1600,
          height: img.naturalHeight || 1000,
        });
      };
      img.onerror = () => resolve({ width: 1600, height: 1000 });
      img.src = src;
    });
  }

  private stopVideo(): void {
    this.playingVideoId.set(null);
    this.playingEmbedUrl.set(null);
  }
}

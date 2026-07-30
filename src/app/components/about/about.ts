import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { CarouselModule, OwlOptions } from 'ngx-owl-carousel-o';
import { RevealDirective } from '../../directives/reveal';
import { AboutContent, AboutReview } from '../../data/site-content.model';

/** Material-style woman icon (dress silhouette). */
const WOMAN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm2.94 6.31C14.62 7.52 13.85 7 13 7h-2c-.85 0-1.62.52-1.94 1.31L5 16h3.5v6h7v-6H19z"/></svg>`;

/** Material-style man icon. */
const MAN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 6c2.21 0 4 1.79 4 4v1h2v7h-4v-5h-4v5H6v-7h2v-1c0-2.21 1.79-4 4-4z"/></svg>`;

const STAR_SLOTS = [1, 2, 3, 4, 5] as const;

@Component({
  selector: 'app-about',
  imports: [RevealDirective, MatIconModule, CarouselModule],
  host: { class: 'block' },
  templateUrl: './about.html',
})
export class About {
  private readonly platformId = inject(PLATFORM_ID);

  readonly content = input.required<AboutContent>();

  protected readonly starSlots = STAR_SLOTS;
  protected readonly reviews = computed(() => this.content().reviews ?? []);
  protected readonly hasReviews = computed(() => this.reviews().length > 0);

  /** Owl carousel needs the browser; skip during SSR/prerender. */
  protected readonly carouselReady = signal(false);

  protected readonly reviewCarouselOptions: OwlOptions = {
    loop: true,
    items: 2,
    mouseDrag: true,
    touchDrag: true,
    pullDrag: true,
    dots: true,
    nav: false,
    autoplay: true,
    autoplayTimeout: 5500,
    autoplayHoverPause: true,
    autoplaySpeed: 600,
    smartSpeed: 500,
    margin: 28,
    slideBy: 1,
    responsive: {
      0: { items: 1, margin: 0 },
      720: { items: 2, margin: 28 },
    },
  };

  constructor() {
    const iconRegistry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);

    iconRegistry.addSvgIconLiteral(
      'review-woman',
      sanitizer.bypassSecurityTrustHtml(WOMAN_ICON_SVG),
    );
    iconRegistry.addSvgIconLiteral(
      'review-man',
      sanitizer.bypassSecurityTrustHtml(MAN_ICON_SVG),
    );

    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.carouselReady.set(true);
      }
    });
  }

  protected hasReviewPhoto(review: AboutReview): boolean {
    return Boolean(review.image?.trim());
  }

  protected reviewAvatarIcon(review: AboutReview): string {
    return review.gender === 'woman' ? 'review-woman' : 'review-man';
  }

  protected reviewImage(review: AboutReview): string {
    return review.image?.trim() ?? '';
  }

  protected reviewImageAlt(review: AboutReview): string {
    const photo = review.image?.trim();
    if (photo && review.imageAlt?.trim()) {
      return review.imageAlt;
    }
    return review.gender === 'woman'
      ? `${review.name} — woman avatar`
      : `${review.name} — man avatar`;
  }

  protected reviewRating(review: AboutReview): number {
    const value = Number(review.rating);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(5, Math.max(0, Math.round(value)));
  }

  protected isStarFilled(review: AboutReview, star: number): boolean {
    return star <= this.reviewRating(review);
  }
}

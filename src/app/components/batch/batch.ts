import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval } from 'rxjs';
import { LaunchCelebrationService } from '../../services/launch-celebration.service';
import { BatchCelebration } from './batch-celebration';
import { BatchLive } from './batch-live';
import {
  BatchContent,
  ProductItem,
  isBatchLive,
  isProductUnavailable,
  isWithinLaunchCelebrationDay,
  whatsappBuyUrl,
  whatsappCustomDesignUrl,
} from '../../data/site-content.model';

export interface CountdownParts {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  totalMs: number;
}

/** Decorative confetti pieces for the launch-day rain. */
const CONFETTI_PIECES = Array.from({ length: 36 }, (_, i) => i + 1);

@Component({
  selector: 'app-batch',
  imports: [BatchCelebration, BatchLive],
  host: { class: 'block' },
  templateUrl: './batch.html',
  styleUrl: './batch.css',
})
export class Batch implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly launchCelebration = inject(LaunchCelebrationService);

  readonly content = input.required<BatchContent>();
  readonly brand = input.required<string>();
  readonly whatsapp = input.required<string>();
  /** Home: show countdown only (no product grid). */
  readonly timerOnly = input(false);

  protected readonly now = signal(Date.now());
  /** Becomes true only in the browser after first paint (avoids SSR hydration hiding the popup). */
  protected readonly browserReady = signal(false);
  protected readonly activeIndexes = signal<Record<string, number>>({});
  protected readonly lightboxProduct = signal<ProductItem | null>(null);
  protected readonly confettiPieces = Array.from({ length: 36 }, (_, i) => i + 1);

  protected readonly live = computed(() => isBatchLive(this.content().launchAt, this.now()));

  protected readonly photoIndexFn = (productId: string) => this.photoIndex(productId);
  protected readonly setPhotoFn = (productId: string, index: number) => this.setPhoto(productId, index);
  protected readonly prevPhotoFn = (product: ProductItem, event: Event) => this.prevPhoto(product, event);
  protected readonly nextPhotoFn = (product: ProductItem, event: Event) => this.nextPhoto(product, event);
  protected readonly openLightboxFn = (product: ProductItem) => this.openLightbox(product);
  protected readonly buyUrlFn = (product: ProductItem) => this.buyUrl(product);
  protected readonly customUrlFn = (product: ProductItem) => this.customUrl(product);
  protected readonly isUnavailableFn = (product: ProductItem) => this.isUnavailable(product);

  /** First 24 hours after launch. */
  protected readonly celebrationDay = computed(() =>
    isWithinLaunchCelebrationDay(this.content().launchAt, this.now()),
  );

  /**
   * Home-only launch popup. Hidden after "View the batch" for this SPA session;
   * shows again only after a full website reload.
   */
  protected readonly celebrationOpen = computed(
    () =>
      this.timerOnly() &&
      this.browserReady() &&
      this.celebrationDay() &&
      !this.launchCelebration.isDismissed(this.content().id),
  );

  protected readonly sectionClass = computed(() => {
    const timer = this.timerOnly();
    const isLive = this.live();
    const celebrating = this.celebrationOpen();

    if (timer && isLive && !celebrating) {
      return 'hidden';
    }

    if (timer && isLive && celebrating) {
      return 'relative min-h-0 bg-transparent p-0';
    }

    if (timer) {
      return 'relative bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(154,143,130,0.28),transparent_70%),var(--color-clay)] px-6 pt-[clamp(2rem,5vw,3rem)] pb-[clamp(2.5rem,6vw,3.5rem)]';
    }

    return 'relative bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(154,143,130,0.28),transparent_70%),var(--color-clay)] px-6 pt-[clamp(4rem,9vw,6.5rem)] pb-[clamp(5rem,10vw,7.5rem)]';
  });

  protected readonly countdown = computed((): CountdownParts => {
    const launch = Date.parse(this.content().launchAt);
    const totalMs = Number.isFinite(launch)
      ? Math.max(0, launch - this.now())
      : 0;
    const totalSeconds = Math.floor(totalMs / 1000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    return {
      days: this.pad(days),
      hours: this.pad(hours),
      minutes: this.pad(minutes),
      seconds: this.pad(seconds),
      totalMs,
    };
  });

  private celebrationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    interval(250)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));

    effect(() => {
      const items = this.content().items;
      this.activeIndexes.set(Object.fromEntries(items.map((item) => [item.id, 0])));
    });

    afterNextRender(() => {
      this.browserReady.set(true);
    });

    // Lock body scroll while popup is open; auto-dismiss after 15s.
    effect(() => {
      const open = this.celebrationOpen();
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }
      if (open) {
        this.document.body.style.overflow = 'hidden';
        if (this.celebrationTimer) {
          clearTimeout(this.celebrationTimer);
        }
        this.celebrationTimer = setTimeout(() => {
          this.launchCelebration.dismiss(this.content().id);
          this.unlockScroll();
          this.celebrationTimer = null;
        }, 15_000);
      } else {
        this.unlockScroll();
        if (this.celebrationTimer) {
          clearTimeout(this.celebrationTimer);
          this.celebrationTimer = null;
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.unlockScroll();
    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.celebrationOpen()) {
      this.dismissCelebration();
      return;
    }
    if (this.lightboxProduct()) {
      this.closeLightbox();
    }
  }

  protected dismissCelebration(): void {
    this.launchCelebration.dismiss(this.content().id);
    this.unlockScroll();
    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
      this.celebrationTimer = null;
    }
    void this.router.navigateByUrl('/batch');
  }

  protected photoIndex(productId: string): number {
    return this.activeIndexes()[productId] ?? 0;
  }

  protected setPhoto(productId: string, index: number, event?: Event): void {
    event?.stopPropagation();
    this.activeIndexes.update((map) => ({ ...map, [productId]: index }));
  }

  protected prevPhoto(product: ProductItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const current = this.photoIndex(product.id);
    const next = (current - 1 + product.images.length) % product.images.length;
    this.setPhoto(product.id, next);
  }

  protected nextPhoto(product: ProductItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const current = this.photoIndex(product.id);
    const next = (current + 1) % product.images.length;
    this.setPhoto(product.id, next);
  }

  protected openLightbox(product: ProductItem): void {
    this.lightboxProduct.set(product);
    this.document.body.style.overflow = 'hidden';
  }

  protected closeLightbox(): void {
    this.lightboxProduct.set(null);
    this.unlockScroll();
  }

  protected buyUrl(product: ProductItem): string {
    return whatsappBuyUrl(
      this.whatsapp(),
      this.brand(),
      product.name,
      product.price,
      this.content().shop.currencySymbol,
      this.content().label,
    );
  }

  protected customUrl(product: ProductItem): string {
    return whatsappCustomDesignUrl(
      this.whatsapp(),
      this.brand(),
      product.name,
      this.content().label,
      product.dimensions,
      product.colors.map((color) => color.name),
    );
  }

  protected isUnavailable(product: ProductItem): boolean {
    return isProductUnavailable(this.content(), product);
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  private unlockScroll(): void {
    this.document.body.style.overflow = '';
  }
}

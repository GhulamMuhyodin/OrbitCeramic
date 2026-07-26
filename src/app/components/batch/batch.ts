import { DecimalPipe, DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { RevealDirective } from '../../directives/reveal';
import {
  BatchContent,
  ProductItem,
  isBatchLive,
  isProductUnavailable,
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

@Component({
  selector: 'app-batch',
  imports: [DecimalPipe, RevealDirective, RouterLink],
  host: { class: 'block' },
  templateUrl: './batch.html',
  styleUrl: './batch.css',
})
export class Batch implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly content = input.required<BatchContent>();
  readonly brand = input.required<string>();
  readonly whatsapp = input.required<string>();
  /** Home: show countdown only (no product grid). */
  readonly timerOnly = input(false);

  protected readonly now = signal(Date.now());
  protected readonly celebrating = signal(false);
  protected readonly activeIndexes = signal<Record<string, number>>({});
  protected readonly lightboxProduct = signal<ProductItem | null>(null);

  protected readonly live = computed(() => isBatchLive(this.content().launchAt, this.now()));

  protected readonly sectionClass = computed(() => {
    const timer = this.timerOnly();
    const isLive = this.live();
    const celebrating = this.celebrating();

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
    const totalMs = Math.max(0, launch - this.now());
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

  private wasLive = false;
  private celebrationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    interval(250)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tick());

    effect(() => {
      const items = this.content().items;
      this.activeIndexes.set(Object.fromEntries(items.map((item) => [item.id, 0])));
    });

    effect(() => {
      this.wasLive = isBatchLive(this.content().launchAt, this.now());
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
    if (this.lightboxProduct()) {
      this.closeLightbox();
    }
  }

  protected dismissCelebration(): void {
    this.celebrating.set(false);
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

  private tick(): void {
    const stamp = Date.now();
    const liveNow = isBatchLive(this.content().launchAt, stamp);
    this.now.set(stamp);

    if (liveNow && !this.wasLive) {
      this.wasLive = true;
      this.startCelebration();
    } else if (liveNow) {
      this.wasLive = true;
    }
  }

  private startCelebration(): void {
    this.celebrating.set(true);
    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
    }
    this.celebrationTimer = setTimeout(() => {
      this.celebrating.set(false);
      this.celebrationTimer = null;
    }, 8_000);
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  private unlockScroll(): void {
    this.document.body.style.overflow = '';
  }
}

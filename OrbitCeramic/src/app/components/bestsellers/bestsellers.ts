import { DecimalPipe, DOCUMENT } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RevealDirective } from '../../directives/reveal';
import {
  BestsellersContent,
  ProductItem,
  whatsappBuyUrl,
} from '../../data/site-content.model';

@Component({
  selector: 'app-bestsellers',
  imports: [DecimalPipe, RevealDirective],
  templateUrl: './bestsellers.html',
  styleUrl: './bestsellers.css',
})
export class Bestsellers implements OnDestroy {
  private readonly document = inject(DOCUMENT);

  readonly content = input.required<BestsellersContent>();
  readonly brand = input.required<string>();
  readonly whatsapp = input.required<string>();

  protected readonly activeIndexes = signal<Record<string, number>>({});
  protected readonly lightboxProduct = signal<ProductItem | null>(null);

  constructor() {
    effect(() => {
      const items = this.content().items;
      this.activeIndexes.set(Object.fromEntries(items.map((item) => [item.id, 0])));
    });
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.lightboxProduct()) {
      this.closeLightbox();
    }
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
      this.content().currencySymbol,
    );
  }

  private unlockScroll(): void {
    this.document.body.style.overflow = '';
  }
}

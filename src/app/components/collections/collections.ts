import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BatchContent,
  CollectionsContent,
  ProductItem,
  isBatchLive,
  isProductUnavailable,
  whatsappCustomDesignUrl,
} from '../../data/site-content.model';

interface CollectionFolder {
  batch: BatchContent;
  products: ProductItem[];
}

interface CollectionProductRow {
  batch: BatchContent;
  product: ProductItem;
}

type CollectionsViewMode = 'by-batch' | 'view-all';

const PAGE_SIZE = 8;

@Component({
  selector: 'app-collections',
  imports: [RouterLink],
  host: { class: 'block' },
  templateUrl: './collections.html',
})
export class Collections {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly loadMoreSentinel = viewChild<ElementRef<HTMLElement>>('loadMoreSentinel');

  readonly content = input.required<CollectionsContent>();
  readonly batches = input.required<BatchContent[]>();
  readonly brand = input.required<string>();
  readonly whatsapp = input.required<string>();

  /** Published batches as folders (live or sold-out archive). */
  protected readonly folders = computed((): CollectionFolder[] =>
    this.batches()
      .filter((batch) => (batch.soldOut || isBatchLive(batch.launchAt)) && batch.items.length > 0)
      .map((batch) => ({ batch, products: batch.items })),
  );

  protected readonly isEmpty = computed(() => this.folders().length === 0);

  /** Flat catalog: available first, sold-out last. */
  protected readonly allProducts = computed((): CollectionProductRow[] => {
    const rows = this.folders().flatMap((folder) =>
      folder.products.map((product) => ({ batch: folder.batch, product })),
    );
    return [...rows].sort((a, b) => {
      const aOut = isProductUnavailable(a.batch, a.product) ? 1 : 0;
      const bOut = isProductUnavailable(b.batch, b.product) ? 1 : 0;
      return aOut - bOut;
    });
  });

  protected readonly viewMode = signal<CollectionsViewMode>('view-all');
  protected readonly visibleCount = signal(PAGE_SIZE);

  protected readonly visibleProducts = computed(() =>
    this.allProducts().slice(0, this.visibleCount()),
  );

  protected readonly hasMore = computed(
    () => this.viewMode() === 'view-all' && this.visibleCount() < this.allProducts().length,
  );

  /** Open folder ids — all collapsed by default. */
  protected readonly openFolderIds = signal<Set<string>>(new Set());
  protected readonly activeIndexes = signal<Record<string, number>>({});

  constructor() {
    effect((onCleanup) => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }
      if (!this.hasMore()) {
        return;
      }

      const sentinel = this.loadMoreSentinel()?.nativeElement;
      if (!sentinel) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting) && this.hasMore()) {
            this.visibleCount.update((count) =>
              Math.min(count + PAGE_SIZE, this.allProducts().length),
            );
          }
        },
        { rootMargin: '240px 0px' },
      );

      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });
  }

  protected setViewMode(mode: CollectionsViewMode): void {
    this.viewMode.set(mode);
    if (mode === 'view-all') {
      this.visibleCount.set(PAGE_SIZE);
    }
  }

  protected isOpen(batchId: string): boolean {
    return this.openFolderIds().has(batchId);
  }

  protected toggleFolder(batchId: string): void {
    this.openFolderIds.update((current) => {
      const next = new Set(current);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
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

  protected customUrl(batch: BatchContent, product: ProductItem): string {
    return whatsappCustomDesignUrl(
      this.whatsapp(),
      this.brand(),
      product.name,
      batch.label,
      product.dimensions,
      product.colors.map((color) => color.name),
    );
  }

  protected isUnavailable(batch: BatchContent, product: ProductItem): boolean {
    return isProductUnavailable(batch, product);
  }
}

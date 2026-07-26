import { Component, computed, input, signal } from '@angular/core';
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

@Component({
  selector: 'app-collections',
  imports: [RouterLink],
  host: { class: 'block' },
  templateUrl: './collections.html',
})
export class Collections {
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

  /** Open folder ids — all collapsed by default. */
  protected readonly openFolderIds = signal<Set<string>>(new Set());
  protected readonly activeIndexes = signal<Record<string, number>>({});

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

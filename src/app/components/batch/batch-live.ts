import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BatchContent, ProductItem } from '../../data/site-content.model';

@Component({
  selector: 'app-batch-live',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './batch-live.html',
})
export class BatchLive {
  readonly content = input.required<BatchContent>();
  readonly photoIndex = input.required<(productId: string) => number>();
  readonly setPhoto = input.required<(productId: string, index: number) => void>();
  readonly prevPhoto = input.required<(product: ProductItem, event: Event) => void>();
  readonly nextPhoto = input.required<(product: ProductItem, event: Event) => void>();
  readonly openLightbox = input.required<(product: ProductItem) => void>();
  readonly buyUrl = input.required<(product: ProductItem) => string>();
  readonly customUrl = input.required<(product: ProductItem) => string>();
  readonly isUnavailable = input.required<(product: ProductItem) => boolean>();
}

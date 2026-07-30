import { Injectable, signal } from '@angular/core';

/**
 * Remembers launch-celebration dismissals for the current SPA session.
 * Survives home ↔ batch routing; resets on full page reload.
 */
@Injectable({ providedIn: 'root' })
export class LaunchCelebrationService {
  private readonly dismissedBatchIds = signal<ReadonlySet<string>>(new Set());

  isDismissed(batchId: string): boolean {
    return this.dismissedBatchIds().has(batchId);
  }

  dismiss(batchId: string): void {
    this.dismissedBatchIds.update((ids) => {
      const next = new Set(ids);
      next.add(batchId);
      return next;
    });
  }
}

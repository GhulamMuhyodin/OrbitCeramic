import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiLoadingService {
  private readonly pendingRequests = signal(0);

  readonly loading = computed(() => this.pendingRequests() > 0);

  start(): void {
    this.pendingRequests.update((count) => count + 1);
  }

  stop(): void {
    this.pendingRequests.update((count) => Math.max(0, count - 1));
  }
}

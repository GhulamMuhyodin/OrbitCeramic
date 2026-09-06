import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BatchRow,
  getBatchScheduleStatus,
  isBatchLive,
} from '../../../data/site-content.model';
import { AdminAuthService } from '../../admin-auth.service';
import { AdminDbService } from '../../admin-db.service';

interface AttentionItem {
  label: string;
  detail: string;
  path: string;
  tone: 'warn' | 'info' | 'ok';
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [DatePipe, RouterLink],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-auto' },
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboardPage {
  private readonly adminDb = inject(AdminDbService);
  private readonly auth = inject(AdminAuthService);
  private readonly db = this.adminDb.db;

  protected readonly now = Date.now();
  protected readonly userName = computed(
    () => this.auth.user()?.displayName || this.auth.user()?.username || 'there',
  );

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  protected readonly overview = computed(() => {
    const d = this.db();
    if (!d) {
      return null;
    }

    const now = Date.now();
    const batches = d.batches;
    const liveWindow = batches.find((b) => getBatchScheduleStatus(b.launchAt, now) === 'live');
    const onShop = latestLaunched(batches, now);
    const nextDrop = earliestScheduled(batches, now);
    const focus = liveWindow ?? onShop;

    const productCount = batches.reduce((n, b) => n + b.products.length, 0);
    const soldOutProducts = batches.reduce(
      (n, b) => n + b.products.filter((p) => p.soldOut || b.soldOut).length,
      0,
    );
    const availableProducts = productCount - soldOutProducts;
    const reviewCount = d.pageCopy.about.reviews.length;

    return {
      brand: d.pageCopy.hero.brand || d.site.brand || 'Orbit',
      batchCount: batches.length,
      productCount,
      availableProducts,
      soldOutProducts,
      reviewCount,
      liveWindow,
      onShop,
      focus,
      nextDrop,
      focusStatus: focus ? getBatchScheduleStatus(focus.launchAt, now) : null,
      focusAvailable:
        focus && !focus.soldOut
          ? focus.products.filter((p) => !p.soldOut).length
          : 0,
      focusTotal: focus?.products.length ?? 0,
    };
  });

  protected readonly attention = computed((): AttentionItem[] => {
    const o = this.overview();
    if (!o) {
      return [];
    }

    const items: AttentionItem[] = [];

    if (o.batchCount === 0) {
      items.push({
        label: 'No batches yet',
        detail: 'Create your first collection and set a launch time.',
        path: '/admin/batches',
        tone: 'warn',
      });
      return items;
    }

    if (o.liveWindow?.soldOut) {
      items.push({
        label: `${o.liveWindow.label} is sold out while LIVE`,
        detail: 'Customers still see it as live — clear sold-out or prepare the next drop.',
        path: `/admin/batches/${o.liveWindow.id}`,
        tone: 'warn',
      });
    } else if (o.focus && o.focusAvailable === 0 && o.focusTotal > 0) {
      items.push({
        label: `All products sold out in ${o.focus.label}`,
        detail: 'Mark the batch sold out or restock before the next inquiry wave.',
        path: `/admin/batches/${o.focus.id}`,
        tone: 'warn',
      });
    }

    if (!o.nextDrop) {
      items.push({
        label: 'No upcoming drop',
        detail: 'Schedule the next batch so the home countdown has a target.',
        path: '/admin/batches',
        tone: 'info',
      });
    }

    if (o.reviewCount === 0) {
      items.push({
        label: 'No reviews on About',
        detail: 'Add a few client voices when you have a quiet moment.',
        path: '/admin/reviews',
        tone: 'info',
      });
    }

    if (!items.length) {
      items.push({
        label: 'Studio looks settled',
        detail: 'Live status, next drop, and catalog are in good shape.',
        path: '/admin/batches',
        tone: 'ok',
      });
    }

    return items;
  });

  protected readonly shortcuts = [
    {
      path: '/admin/batches',
      title: 'Batches',
      desc: 'Launch dates, products, sold-out',
      icon: 'inventory_2',
    },
    {
      path: '/admin/countdown',
      title: 'Countdown',
      desc: 'Pre-launch and celebration copy',
      icon: 'timer',
    },
    {
      path: '/admin/site',
      title: 'Site & Contact',
      desc: 'Brand, WhatsApp, active batch',
      icon: 'storefront',
    },
    {
      path: '/admin/reviews',
      title: 'Reviews',
      desc: 'Client voices on About',
      icon: 'rate_review',
    },
  ] as const;

  protected statusLabel(batch: BatchRow | null | undefined): string {
    if (!batch) {
      return '—';
    }
    if (batch.soldOut) {
      return 'Sold out';
    }
    const status = getBatchScheduleStatus(batch.launchAt);
    if (status === 'scheduled') return 'Scheduled';
    if (status === 'live') return 'LIVE';
    return 'On shop';
  }
}

function earliestScheduled(batches: BatchRow[], now: number): BatchRow | undefined {
  return [...batches]
    .filter((b) => getBatchScheduleStatus(b.launchAt, now) === 'scheduled')
    .sort((a, b) => Date.parse(a.launchAt) - Date.parse(b.launchAt))[0];
}

function latestLaunched(batches: BatchRow[], now: number): BatchRow | undefined {
  return [...batches]
    .filter((b) => isBatchLive(b.launchAt, now))
    .sort((a, b) => Date.parse(b.launchAt) - Date.parse(a.launchAt))[0];
}

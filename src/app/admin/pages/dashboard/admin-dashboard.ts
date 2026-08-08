import { Component, computed, inject } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { isBatchLive } from '../../../data/site-content.model';
import { AdminDbService } from '../../admin-db.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CardModule, ChartModule],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6' },
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboardPage {
  private readonly adminDb = inject(AdminDbService);
  private readonly db = this.adminDb.db;

  protected readonly stats = computed(() => {
    const d = this.db();
    if (!d) {
      return null;
    }
    const active = d.batches.find((b) => b.id === d.site.activeBatchId) ?? d.batches[0];
    if (!active) {
      return null;
    }
    const now = Date.now();
    return {
      batchCount: d.batches.length,
      productCount: d.batches.reduce((n, b) => n + b.products.length, 0),
      reviewCount: d.pageCopy.about.reviews.length,
      activeLabel: active.label,
      activeLive: isBatchLive(active.launchAt, now),
      launchAt: active.launchAt,
    };
  });

  protected readonly modules = [
    {
      path: '/admin/site',
      title: 'Site & Contact',
      desc: 'Brand, active batch, WhatsApp, email',
      icon: 'storefront',
    },
    {
      path: '/admin/batches',
      title: 'Batches',
      desc: 'Launch date, products and batch details',
      icon: 'inventory_2',
    },
    {
      path: '/admin/about',
      title: 'About & Reviews',
      desc: 'Maker bio and client voices',
      icon: 'rate_review',
    },
  ];

  protected readonly salesChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    datasets: [
      {
        label: 'Sales',
        data: [72, 58, 78, 64, 86, 92, 74, 96],
        borderColor: '#7ea8ff',
        backgroundColor: 'rgba(126, 168, 255, 0.18)',
        tension: 0.38,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: 'Target',
        data: [64, 68, 70, 72, 80, 81, 86, 88],
        borderColor: '#f0b77a',
        backgroundColor: 'rgba(240, 183, 122, 0.12)',
        tension: 0.38,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  protected readonly salesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#fff',
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6b7280', font: { size: 12 } },
      },
      y: {
        display: false,
        grid: { display: false },
      },
    },
  };
}

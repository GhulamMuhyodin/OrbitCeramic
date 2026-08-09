import { Routes } from '@angular/router';
import { AdminLayout } from './layout/admin-layout';
import { adminAuthGuard } from './admin-auth.guard';

export const adminRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/admin-login').then((m) => m.AdminLoginPage),
    title: 'Admin sign in — Orbit Ceramic',
  },
  {
    path: '',
    component: AdminLayout,
    canActivate: [adminAuthGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/admin-dashboard').then((m) => m.AdminDashboardPage),
        title: 'Admin — Orbit Ceramic',
      },
      {
        path: 'site',
        loadComponent: () =>
          import('./pages/site/admin-site').then((m) => m.AdminSitePage),
        title: 'Site & Contact — Admin',
      },
      {
        path: 'batches',
        loadComponent: () =>
          import('./pages/batches/admin-batches').then((m) => m.AdminBatchesPage),
        title: 'Batches — Admin',
      },
      {
        path: 'batches/:batchId',
        loadComponent: () =>
          import('./pages/batch-detail/admin-batch-detail').then((m) => m.AdminBatchDetailPage),
        title: 'Batch detail — Admin',
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./pages/about/admin-about').then((m) => m.AdminAboutPage),
        title: 'About — Admin',
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./pages/reviews/admin-reviews').then((m) => m.AdminReviewsPage),
        title: 'Reviews — Admin',
      },
    ],
  },
];

import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AdminDbService } from '../admin-db.service';
import { ApiLoadingService } from '../../services/api-loading.service';
import { AdminAuthService } from '../admin-auth.service';

interface AdminNavItem {
  label: string;
  path: string;
  icon: string;
  hint: string;
}

@Component({
  selector: 'app-admin-layout',
  imports: [
    RouterOutlet,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    ProgressSpinnerModule,
    ToastModule,
  ],
  providers: [MessageService],
  host: { class: 'block h-dvh overflow-hidden font-body text-ink' },
  templateUrl: './admin-layout.html',
})
export class AdminLayout implements OnInit {
  private readonly adminDb = inject(AdminDbService);
  private readonly messageService = inject(MessageService);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly router = inject(Router);
  private readonly auth = inject(AdminAuthService);
  protected readonly apiLoading = inject(ApiLoadingService);

  protected readonly db = this.adminDb.db;
  protected readonly dirty = this.adminDb.dirty;
  protected readonly ready = this.adminDb.ready;
  protected readonly persistedBatchCount = computed(
    () => this.db()?.batches.filter((batch) => this.adminDb.isBatchPersisted(batch.id)).length ?? 0,
  );

  protected readonly sidenavOpened = signal(true);
  protected readonly passwordDialogOpen = signal(false);
  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly passwordError = signal<string | null>(null);
  protected readonly passwordSaving = signal(false);

  private readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset, Breakpoints.TabletPortrait]).pipe(
      map((r) => r.matches),
    ),
    { initialValue: false },
  );

  protected readonly sidenavMode = computed(() => (this.isHandset() ? 'over' : 'side'));
  protected readonly isMobile = computed(() => this.isHandset());

  protected readonly nav: AdminNavItem[] = [
    { label: 'Dashboard', path: '/admin', icon: 'dashboard', hint: 'overview' },
    { label: 'Site & Contact', path: '/admin/site', icon: 'storefront', hint: 'brand · WhatsApp · info' },
    { label: 'Batches', path: '/admin/batches', icon: 'inventory_2', hint: 'launch · products' },
    { label: 'Countdown', path: '/admin/countdown', icon: 'timer', hint: 'countdown · celebration' },
    { label: 'About', path: '/admin/about', icon: 'article', hint: 'bio · copy' },
    { label: 'Reviews', path: '/admin/reviews', icon: 'rate_review', hint: 'client voices' },
  ];

  ngOnInit(): void {
    this.adminDb.load().subscribe({
      error: (err) =>
        this.messageService.add({
          severity: 'error',
          summary: 'Load failed',
          detail: err?.message ?? 'Could not load from API',
          life: 6000,
        }),
    });

    this.breakpoints.observe([Breakpoints.Handset, Breakpoints.TabletPortrait]).subscribe((r) => {
      this.sidenavOpened.set(!r.matches);
    });

    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      if (this.isHandset()) {
        this.sidenavOpened.set(false);
      }
    });
  }

  protected toggleNav(): void {
    this.sidenavOpened.update((v) => !v);
  }

  protected closeNavOnMobile(): void {
    if (this.isHandset()) {
      this.sidenavOpened.set(false);
    }
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/admin/login']),
      error: () => {
        this.auth.clearSession();
        void this.router.navigate(['/admin/login']);
      },
    });
  }

  protected openPasswordDialog(): void {
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.passwordError.set(null);
    this.passwordDialogOpen.set(true);
  }

  protected closePasswordDialog(): void {
    if (!this.passwordSaving()) {
      this.passwordDialogOpen.set(false);
    }
  }

  protected changePassword(): void {
    if (this.newPassword().length < 8) {
      this.passwordError.set('New password must be at least 8 characters.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('New password and confirmation do not match.');
      return;
    }
    this.passwordSaving.set(true);
    this.passwordError.set(null);
    this.auth.changePassword(this.currentPassword(), this.newPassword()).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.passwordDialogOpen.set(false);
        this.messageService.add({ severity: 'success', summary: 'Password changed', detail: 'Your password was updated successfully.', life: 3500 });
      },
      error: (err) => {
        this.passwordSaving.set(false);
        this.passwordError.set(err?.error?.error ?? 'Could not change password.');
      },
    });
  }

  protected saveDraft(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Save workflow',
      detail: 'Use Save on each page (Site, Batch, About…) to write to the database',
      life: 4500,
    });
  }

  protected download(): void {
    this.adminDb.downloadJson();
    this.messageService.add({
      severity: 'success',
      summary: 'Export ready',
      detail: 'Downloaded export JSON (backup only — live data is in MySQL)',
      life: 4500,
    });
  }

  protected reset(): void {
    if (!confirm('Reload all content from the API / database? Unsaved edits will be lost.')) {
      return;
    }
    this.adminDb.resetToServerFile().subscribe({
      next: () =>
        this.messageService.add({
          severity: 'success',
          summary: 'Reloaded',
          detail: 'Reloaded from API',
          life: 2500,
        }),
      error: (err) =>
        this.messageService.add({
          severity: 'error',
          summary: 'Reload failed',
          detail: err?.message ?? 'Reload failed',
          life: 4000,
        }),
    });
  }
}

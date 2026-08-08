import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { Router, RouterLink } from '@angular/router';
import { getBatchScheduleStatus, isBatchLive } from '../../../data/site-content.model';
import { AdminDbService } from '../../admin-db.service';

@Component({
  selector: 'app-admin-batches',
  imports: [
    DatePipe,
    RouterLink,
    ButtonModule,
    TableModule,
    ProgressSpinnerModule,
    ToastModule,
  ],
  providers: [MessageService],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6' },
  templateUrl: './admin-batches.html',
})
export class AdminBatchesPage {
  private readonly adminDb = inject(AdminDbService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  protected readonly db = this.adminDb.db;
  protected readonly creating = signal(false);
  protected readonly columns = ['label', 'launch', 'status', 'products', 'actions'];

  protected readonly batches = computed(() =>
    (this.db()?.batches ?? []).filter((batch) => this.adminDb.isBatchPersisted(batch.id)),
  );

  protected isLive(launchAt: string): boolean {
    return isBatchLive(launchAt);
  }

  protected addBatch(): void {
    if (this.creating()) {
      return;
    }
    if (!this.db()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Content not loaded',
        detail: 'Start orbit-api (START-API.bat) and reload',
        life: 6000,
      });
      return;
    }

    const draft = this.adminDb.createEmptyBatch();
    this.creating.set(true);
    this.adminDb.upsertBatch(draft);
    this.creating.set(false);
    this.messageService.add({
      severity: 'info',
      summary: 'Scheduled draft ready',
      detail: `${draft.label} is scheduled for next week. Add the content, then Save to database.`,
      life: 4500,
    });
    void this.router.navigate(['/admin/batches', draft.id]);
  }

  protected deleteBatch(id: string, label: string): void {
    if (!confirm(`Delete ${label} and its products / linked media?`)) {
      return;
    }
    this.adminDb.deleteBatchRemote(id).subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `Deleted ${label}`, life: 2500 }),
      error: (err) =>
        this.messageService.add({ severity: 'error', summary: 'Delete failed', detail: err?.error?.error ?? err?.message ?? 'Delete failed', life: 5000 }),
    });
  }

  protected setActive(id: string): void {
    this.adminDb.updateSite({ activeBatchId: id });
    this.adminDb.saveActiveBatch().subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'Active batch updated', life: 2500 }),
      error: (err) =>
        this.messageService.add({ severity: 'error', summary: 'Could not set active', detail: err?.error?.error ?? err?.message ?? 'Could not set active', life: 5000 }),
    });
  }

  protected statusLabel(b: { soldOut: boolean; launchAt: string }): string {
    if (b.soldOut) {
      return 'Sold out';
    }
    const status = getBatchScheduleStatus(b.launchAt);
    if (status === 'scheduled') {
      return 'Scheduled';
    }
    if (status === 'live') {
      return 'Live';
    }
    return 'Complete';
  }
}

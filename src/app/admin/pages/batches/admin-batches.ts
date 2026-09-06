import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { Router, RouterLink } from '@angular/router';
import { getBatchScheduleStatus, isBatchLive } from '../../../data/site-content.model';
import { AdminDbService } from '../../admin-db.service';

@Component({
  selector: 'app-admin-batches',
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    ConfirmDialogModule,
    TableModule,
    ProgressSpinnerModule,
    ToastModule,
  ],
  providers: [MessageService, ConfirmationService],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6' },
  templateUrl: './admin-batches.html',
})
export class AdminBatchesPage {
  private readonly adminDb = inject(AdminDbService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  protected readonly db = this.adminDb.db;
  protected readonly creating = signal(false);
  protected readonly expandedBatchIds = signal<Record<string, boolean>>({});
  protected readonly columns = ['label', 'launch', 'status', 'products', 'actions'];

  protected readonly batches = computed(() =>
    (this.db()?.batches ?? []).filter((batch) => this.adminDb.isBatchPersisted(batch.id)),
  );

  protected toggleBatchProducts(batchId: string): void {
    const expanded = this.expandedBatchIds();
    this.expandedBatchIds.set({ ...expanded, [batchId]: !expanded[batchId] });
  }

  protected expandAllProducts(): void {
    const rows = this.batches();
    this.expandedBatchIds.set(Object.fromEntries(rows.map((batch) => [batch.id, true])));
  }

  protected collapseAllProducts(): void {
    this.expandedBatchIds.set({});
  }

  protected patchBatchSoldOut(batchId: string, soldOut: boolean): void {
    const batch = this.db()?.batches.find((b) => b.id === batchId);
    if (!batch) {
      return;
    }

    const confirmMessage = soldOut
      ? `Mark batch ${batch.label} and all its products as sold out?`
      : `Clear sold-out status for batch ${batch.label} and its products?`;

    this.confirmationService.confirm({
      message: confirmMessage,
      accept: () => {
        this.adminDb.setBatchSoldOut(batchId, soldOut).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Saved',
              detail: 'Batch sold-out status saved to server',
              life: 2500,
            });
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Save failed',
              detail: err?.error?.error ?? err?.message ?? 'Unable to save batch status',
              life: 5000,
            });
          },
        });
      },
    });
  }

  protected patchProductSoldOut(batchId: string, productId: string, soldOut: boolean): void {
    const batch = this.db()?.batches.find((b) => b.id === batchId);
    if (!batch) {
      return;
    }
    const product = batch.products.find((p) => p.id === productId);
    if (!product) {
      return;
    }

    const confirmMessage = soldOut
      ? `Mark product ${product.name} as sold out?`
      : `Clear sold-out status for product ${product.name}?`;

    this.confirmationService.confirm({
      message: confirmMessage,
      accept: () => {
        this.adminDb.setProductSoldOut(batchId, productId, soldOut).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Saved',
              detail: 'Product sold-out status saved to server',
              life: 2500,
            });
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Save failed',
              detail: err?.error?.error ?? err?.message ?? 'Unable to save product status',
              life: 5000,
            });
          },
        });
      },
      reject: () => {
        this.adminDb.upsertProduct(batchId, { ...product, soldOut: !soldOut });
        this.adminDb.dirty.set(false);
      },
    });

    return;
  }

  protected onProductSoldOutChange(event: { checked?: boolean }, batchId: string, productId: string): void {
    if (event.checked === undefined) {
      return;
    }
    this.patchProductSoldOut(batchId, productId, event.checked);
  }

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
    const batch = this.db()?.batches.find((b) => b.id === id);
    if (batch && this.isLive(batch.launchAt)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Read only',
        detail: 'This batch is currently LIVE and cannot be modified.',
        life: 4500,
      });
      return;
    }
    this.confirmationService.confirm({
      message: `Delete ${label} and its products / linked media?`,
      accept: () => {
        this.adminDb.deleteBatchRemote(id).subscribe({
          next: () =>
            this.messageService.add({
              severity: 'success',
              summary: 'Deleted',
              detail: `Deleted ${label}`,
              life: 2500,
            }),
          error: (err) =>
            this.messageService.add({
              severity: 'error',
              summary: 'Delete failed',
              detail: err?.error?.error ?? err?.message ?? 'Delete failed',
              life: 5000,
            }),
        });
      },
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

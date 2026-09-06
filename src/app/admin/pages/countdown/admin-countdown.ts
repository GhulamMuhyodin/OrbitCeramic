import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { CountdownPageCopy } from '../../../data/site-content.model';
import { AdminDbService } from '../../admin-db.service';

@Component({
  selector: 'app-admin-countdown',
  imports: [
    FormsModule,
    CardModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    ToastModule,
  ],
  providers: [MessageService],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './admin-countdown.html',
})
export class AdminCountdownPage {
  private readonly adminDb = inject(AdminDbService);
  private readonly messageService = inject(MessageService);
  protected readonly db = this.adminDb.db;
  protected readonly dirty = this.adminDb.dirty;

  protected patchCountdown(field: keyof CountdownPageCopy, value: string): void {
    this.adminDb.updateCountdown({ [field]: value });
  }

  protected save(): void {
    this.adminDb.saveCountdown().subscribe({
      next: () =>
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Countdown & celebration saved to database',
          life: 3000,
        }),
      error: (err) =>
        this.messageService.add({
          severity: 'error',
          summary: 'Save failed',
          detail: err?.error?.error ?? err?.message ?? 'Save failed',
          life: 5000,
        }),
    });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { isValidEmail, isValidPhone, phoneHint } from '../../admin-validators';
import { AdminDbService } from '../../admin-db.service';

@Component({
  selector: 'app-admin-site',
  imports: [
    FormsModule,
    CardModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    ButtonModule,
    ToastModule,
  ],
  providers: [MessageService],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './admin-site.html',
})
export class AdminSitePage {
  private readonly adminDb = inject(AdminDbService);
  private readonly messageService = inject(MessageService);
  protected readonly db = this.adminDb.db;
  protected readonly dirty = this.adminDb.dirty;
  protected readonly formError = signal<string | null>(null);
  protected readonly phoneHint = phoneHint();

  protected readonly visitText = computed(() => (this.db()?.contact.visitLines ?? []).join('\n'));

  protected readonly emailInvalid = computed(() => {
    const email = this.db()?.contact.email ?? '';
    return email.trim().length > 0 && !isValidEmail(email);
  });

  protected readonly phoneInvalid = computed(() => {
    const phone = this.db()?.contact.whatsapp ?? '';
    return phone.trim().length > 0 && !isValidPhone(phone);
  });

  protected patchSite(field: 'brand' | 'activeBatchId', value: string): void {
    this.adminDb.updateSite({ [field]: value });
    this.formError.set(null);
  }

  protected patchContact(
    field: 'whatsapp' | 'email' | 'instagram' | 'instagramHandle' | 'website',
    value: string,
  ): void {
    this.adminDb.updateContact({ [field]: value });
    this.formError.set(null);
  }

  protected onVisitLines(text: string): void {
    this.adminDb.setVisitLines(text.split(/\r?\n/));
  }

  protected save(): void {
    const d = this.db();
    if (!d) {
      return;
    }
    if (!d.site.brand.trim()) {
      this.formError.set('Brand name is required');
      this.messageService.add({ severity: 'error', summary: 'Validation', detail: 'Brand name is required', life: 4000 });
      return;
    }
    if (!isValidPhone(d.contact.whatsapp)) {
      this.formError.set('Enter a valid WhatsApp / phone number');
      this.messageService.add({ severity: 'error', summary: 'Validation', detail: this.phoneHint, life: 5000 });
      return;
    }
    if (!isValidEmail(d.contact.email)) {
      this.formError.set('Enter a valid email address');
      this.messageService.add({ severity: 'error', summary: 'Validation', detail: 'Enter a valid email address', life: 4000 });
      return;
    }
    this.formError.set(null);
    this.adminDb.saveSiteAndContact().subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Site & contact saved to database', life: 3000 }),
      error: (err) =>
        this.messageService.add({ severity: 'error', summary: 'Save failed', detail: err?.error?.error ?? err?.message ?? 'Save failed', life: 5000 }),
    });
  }
}

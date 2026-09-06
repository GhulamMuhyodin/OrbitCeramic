import { Component, computed, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { isValidEmail, isValidPhone, phoneHint } from '../../admin-validators';
import { isBatchLive } from '../../../data/site-content.model';
import { AdminDbService } from '../../admin-db.service';

@Component({
  selector: 'app-admin-site',
  imports: [
    ReactiveFormsModule,
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
  protected readonly uploading = signal(false);
  protected readonly defaultSiteImage = '/images/logo.jpeg';
  protected readonly phoneHint = phoneHint();

  protected readonly siteForm = new FormGroup({
    brand: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    activeBatchId: new FormControl<string | null>(null),
    whatsapp: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, this.createPhoneValidator()],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, this.createEmailValidator()],
    }),
    instagram: new FormControl('', { nonNullable: true }),
    instagramHandle: new FormControl('', { nonNullable: true }),
    lineText: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly brandControl = this.siteForm.get('brand') as FormControl<string>;
  protected readonly whatsappControl = this.siteForm.get('whatsapp') as FormControl<string>;
  protected readonly emailControl = this.siteForm.get('email') as FormControl<string>;
  protected readonly instagramControl = this.siteForm.get('instagram') as FormControl<string>;
  protected readonly instagramHandleControl = this.siteForm.get('instagramHandle') as FormControl<string>;
  protected readonly lineTextControl = this.siteForm.get('lineText') as FormControl<string>;
  constructor() {
    effect(() => {
      const d = this.db();
      if (!d) {
        return;
      }
      this.siteForm.setValue(
        {
          brand: d.site.brand ?? '',
          activeBatchId: d.site.activeBatchId ?? null,
          whatsapp: d.contact.whatsapp ?? '',
          email: d.contact.email ?? '',
          instagram: d.contact.instagram ?? '',
          instagramHandle: d.contact.instagramHandle ?? '',
          lineText: d.contact.lineText ?? '',
        },
        { emitEvent: false },
      );
      // If a batch is currently live, force-select the newest live batch and disable changing the website batch.
      const live = [...d.batches]
        .filter((b) => isBatchLive(b.launchAt))
        .sort((a, b) => Date.parse(b.launchAt) - Date.parse(a.launchAt))[0];
      const ctrl = this.siteForm.get('activeBatchId');
      if (live) {
        // set the newest live batch as selected and disable the control
        ctrl?.setValue(live.id, { emitEvent: false });
        ctrl?.disable({ emitEvent: false });
        // ensure admin DB reflects the active batch as the live batch
        if (d.site.activeBatchId !== live.id) {
          this.adminDb.updateSite({ activeBatchId: live.id });
          // persist immediately
          this.adminDb.saveActiveBatch().subscribe({});
        }
      } else {
        // no live batch: ensure control is enabled
        ctrl?.enable({ emitEvent: false });
      }
    });

    this.siteForm.valueChanges.subscribe((value) => {
      const d = this.db();
      if (!d) {
        return;
      }
      this.adminDb.updateSite({
        brand: value.brand ?? '',
        activeBatchId: value.activeBatchId ?? undefined,
      });
      this.adminDb.updateContact({
        whatsapp: value.whatsapp ?? '',
        email: value.email ?? '',
        instagram: value.instagram ?? '',
        instagramHandle: value.instagramHandle ?? '',
        lineText: value.lineText ?? '',
      });
      this.formError.set(null);
    });
  }

  protected getFieldError(control: AbstractControl): string | null {
    if (!control.touched || !control.invalid) {
      return null;
    }
    if (control.hasError('required')) {
      return 'This field is required.';
    }
    if (control.hasError('invalidPhone')) {
      return this.phoneHint;
    }
    if (control.hasError('invalidEmail')) {
      return 'Enter a valid email address.';
    }
    return 'Invalid value.';
  }

  private createEmailValidator() {
    return (control: AbstractControl) =>
      isValidEmail(control.value) ? null : { invalidEmail: true };
  }

  private createPhoneValidator() {
    return (control: AbstractControl) =>
      isValidPhone(control.value) ? null : { invalidPhone: true };
  }

  protected onRemoveSiteImage(): void {
    this.adminDb.updateSite({ image: '', imageMediaId: undefined });
  }

  protected async onUploadSiteImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.messageService.add({ severity: 'warn', summary: 'Invalid file', detail: 'Please select an image file.', life: 4000 });
      input.value = '';
      return;
    }

    const siteId = this.db()?.site.id;
    this.uploading.set(true);
    try {
      const media = await firstValueFrom(this.adminDb.uploadFile(file, siteId));
      this.adminDb.updateSite({ image: media.publicUrl, imageMediaId: media.id });
      this.messageService.add({ severity: 'success', summary: 'Uploaded', detail: 'Site image uploaded', life: 3000 });
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Upload failed', detail: 'Upload failed', life: 5000 });
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  protected save(): void {
    if (this.siteForm.invalid) {
      this.siteForm.markAllAsTouched();
      this.formError.set('Fix validation errors before saving.');
      this.messageService.add({ severity: 'error', summary: 'Validation', detail: 'Fix validation errors before saving.', life: 5000 });
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

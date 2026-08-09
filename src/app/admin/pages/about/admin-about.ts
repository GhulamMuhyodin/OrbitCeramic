import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { AdminDbService } from '../../admin-db.service';

@Component({
  selector: 'app-admin-about',
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
  templateUrl: './admin-about.html',
})
export class AdminAboutPage {
  private readonly adminDb = inject(AdminDbService);
  private readonly messageService = inject(MessageService);
  protected readonly db = this.adminDb.db;
  protected readonly dirty = this.adminDb.dirty;
  protected readonly uploading = signal(false);

  protected readonly paragraphsText = computed(() =>
    (this.db()?.pageCopy.about.paragraphs ?? []).join('\n\n'),
  );

  protected patchAbout(
    field: 'eyebrow' | 'heading' | 'image' | 'imageAlt' | 'imageMediaId' | 'reviewsEyebrow' | 'reviewsHeading',
    value: string,
  ): void {
    this.adminDb.updateAbout({ [field]: value });
  }

  protected onRemoveAboutImage(): void {
    this.adminDb.updateAbout({ image: '', imageMediaId: '' });
  }

  protected onParagraphs(text: string): void {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    this.adminDb.setAboutParagraphs(paragraphs);
  }

  protected async onUploadAboutImage(event: Event): Promise<void> {
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
    this.uploading.set(true);
    try {
      const media = await firstValueFrom(this.adminDb.uploadFile(file));
      this.adminDb.updateAbout({ image: media.publicUrl, imageMediaId: media.id });
      this.messageService.add({ severity: 'success', summary: 'Uploaded', detail: 'About image uploaded', life: 3000 });
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Upload failed', detail: 'Upload failed', life: 5000 });
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  protected save(): void {
    this.adminDb.saveAbout().subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'About saved to database', life: 3000 }),
      error: (err) =>
        this.messageService.add({ severity: 'error', summary: 'Save failed', detail: err?.error?.error ?? err?.message ?? 'Save failed', life: 5000 }),
    });
  }
}

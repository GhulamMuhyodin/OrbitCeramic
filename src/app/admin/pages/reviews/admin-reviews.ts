import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { AboutReview } from '../../../data/site-content.model';
import { AdminDbService } from '../../admin-db.service';

@Component({
  selector: 'app-admin-reviews',
  imports: [
    FormsModule,
    CardModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    ButtonModule,
    ToastModule,
  ],
  providers: [MessageService],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './admin-reviews.html',
})
export class AdminReviewsPage {
  private readonly adminDb = inject(AdminDbService);
  private readonly messageService = inject(MessageService);

  protected readonly db = this.adminDb.db;
  protected readonly dirty = this.adminDb.dirty;
  protected readonly selectedId = signal<string | null>(null);
  protected readonly reviewDialogOpen = signal(false);
  protected readonly reviewPreview = signal(false);
  protected readonly draftReview = signal<AboutReview | null>(null);
  protected readonly uploading = signal(false);

  protected readonly reviews = computed(() => this.db()?.pageCopy.about.reviews ?? []);

  protected readonly isEditing = computed(() => {
    const draft = this.draftReview();
    return Boolean(draft && this.reviews().some((r) => r.id === draft.id));
  });

  protected readonly reviewDialogTitle = computed(() =>
    this.isEditing() ? 'Edit review' : 'Add review',
  );

  protected addReview(): void {
    this.selectedId.set(null);
    this.reviewPreview.set(false);
    this.draftReview.set(this.adminDb.createEmptyReview());
    this.reviewDialogOpen.set(true);
  }

  protected selectReview(id: string): void {
    const review = this.reviews().find((r) => r.id === id);
    if (!review) {
      return;
    }
    this.selectedId.set(id);
    this.reviewPreview.set(false);
    this.draftReview.set({ ...review });
    this.reviewDialogOpen.set(true);
  }

  protected patchReview(patch: Partial<AboutReview>): void {
    const draft = this.draftReview();
    if (!draft) {
      return;
    }
    this.draftReview.set({ ...draft, ...patch });
  }

  protected async onUploadReviewImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid file',
        detail: 'Please select an image file.',
        life: 4000,
      });
      input.value = '';
      return;
    }

    this.uploading.set(true);
    try {
      const media = await firstValueFrom(this.adminDb.uploadFile(file));
      this.patchReview({ image: media.publicUrl, imageMediaId: media.id });
      this.messageService.add({
        severity: 'success',
        summary: 'Uploaded',
        detail: 'Review image uploaded',
        life: 3000,
      });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Upload failed',
        detail: 'Upload failed',
        life: 5000,
      });
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  protected removeReviewImage(): void {
    this.patchReview({ image: '', imageMediaId: '' });
  }

  protected deleteReviewRow(id: string, event: Event): void {
    event.stopPropagation();
    if (!confirm('Delete this review?')) {
      return;
    }
    this.adminDb.deleteReviewRemote(id).subscribe({
      next: () => {
        if (this.selectedId() === id) {
          this.reviewDialogOpen.set(false);
          this.draftReview.set(null);
          this.selectedId.set(null);
        }
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Review deleted', life: 2500 });
      },
      error: (err) =>
        this.messageService.add({ severity: 'error', summary: 'Delete failed', detail: err?.error?.error ?? err?.message ?? 'Delete failed', life: 5000 }),
    });
  }

  protected showReviewPreview(): void {
    const draft = this.draftReview();
    if (!draft) {
      return;
    }
    if (!draft.name?.trim() || !draft.quote?.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Review incomplete', detail: 'Name and quote are required before previewing.', life: 4000 });
      return;
    }
    this.reviewPreview.set(true);
  }

  protected validateReview(review: AboutReview): string | null {
    if (!review.name?.trim()) {
      return 'Name is required before saving.';
    }
    if (!review.detail?.trim()) {
      return 'Description is required before saving.';
    }
    if (review.rating < 1 || review.rating > 5) {
      return 'Rating must be between 1 and 5.';
    }
    if (!review.image?.trim()) {
      return 'Review image is required before saving.';
    }
    return null;
  }

  protected closeReviewDialog(): void {
    this.reviewDialogOpen.set(false);
    this.reviewPreview.set(false);
    this.draftReview.set(null);
    this.selectedId.set(null);
  }

  protected saveReview(): void {
    const draft = this.draftReview();
    if (!draft) {
      return;
    }
    const validationError = this.validateReview(draft);
    if (validationError) {
      this.messageService.add({ severity: 'warn', summary: 'Review incomplete', detail: validationError, life: 4000 });
      return;
    }
    this.adminDb.saveReview(draft).subscribe({
      next: (saved) => {
        this.reviewDialogOpen.set(false);
        this.reviewPreview.set(false);
        this.selectedId.set(saved.id);
        this.draftReview.set(null);
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Review saved to database', life: 3000 });
      },
      error: (err) =>
        this.messageService.add({ severity: 'error', summary: 'Save failed', detail: err?.error?.error ?? err?.message ?? 'Save failed', life: 5000 }),
    });
  }

  protected save(): void {
    this.adminDb.saveReviews().subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Reviews saved to database', life: 3000 }),
      error: (err) =>
        this.messageService.add({ severity: 'error', summary: 'Save failed', detail: err?.error?.error ?? err?.message ?? 'Save failed', life: 5000 }),
    });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  selector: 'app-admin-about',
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
  templateUrl: './admin-about.html',
})
export class AdminAboutPage {
  private readonly adminDb = inject(AdminDbService);
  private readonly messageService = inject(MessageService);
  protected readonly db = this.adminDb.db;
  protected readonly dirty = this.adminDb.dirty;
  protected readonly selectedId = signal<string | null>(null);
  protected readonly reviewDialogOpen = signal(false);

  protected readonly paragraphsText = computed(() =>
    (this.db()?.pageCopy.about.paragraphs ?? []).join('\n\n'),
  );

  protected readonly review = computed(() => {
    const id = this.selectedId();
    const list = this.db()?.pageCopy.about.reviews ?? [];
    if (!id) {
      return null;
    }
    return list.find((r) => r.id === id) ?? null;
  });

  protected patchAbout(
    field: 'eyebrow' | 'heading' | 'image' | 'imageAlt' | 'reviewsEyebrow' | 'reviewsHeading',
    value: string,
  ): void {
    this.adminDb.updateAbout({ [field]: value });
  }

  protected onParagraphs(text: string): void {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    this.adminDb.setAboutParagraphs(paragraphs);
  }

  protected addReview(): void {
    const r = this.adminDb.createEmptyReview();
    this.adminDb.upsertReview(r);
    this.selectedId.set(r.id);
    this.reviewDialogOpen.set(true);
  }

  protected selectReview(id: string): void {
    this.selectedId.set(id);
    this.reviewDialogOpen.set(true);
  }

  protected patchReview(patch: Partial<AboutReview>): void {
    const r = this.review();
    if (!r) {
      return;
    }
    this.adminDb.upsertReview({ ...r, ...patch });
  }

  protected deleteReview(): void {
    const r = this.review();
    if (!r || !confirm('Delete this review?')) {
      return;
    }
    this.adminDb.deleteReviewRemote(r.id).subscribe({
      next: () => {
        this.selectedId.set(null);
        this.reviewDialogOpen.set(false);
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Review deleted', life: 2500 });
      },
      error: (err) =>
        this.messageService.add({ severity: 'error', summary: 'Delete failed', detail: err?.error?.error ?? err?.message ?? 'Delete failed', life: 5000 }),
    });
  }

  protected save(): void {
    this.adminDb.saveAbout().subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'About & reviews saved to database', life: 3000 }),
      error: (err) =>
        this.messageService.add({ severity: 'error', summary: 'Save failed', detail: err?.error?.error ?? err?.message ?? 'Save failed', life: 5000 }),
    });
  }
}

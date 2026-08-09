import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { firstValueFrom, map } from 'rxjs';
import {
  BatchRow,
  HeroHighlightImageRow,
  JourneyImageRow,
  JourneyVideoRow,
  ProductColorEmbedded,
  ProductImageEmbedded,
  ProductRow,
  getBatchScheduleStatus,
} from '../../../data/site-content.model';
import { isValidAmount, isValidLaunchDate } from '../../admin-validators';
import { AdminDbService } from '../../admin-db.service';

@Component({
  selector: 'app-admin-batch-detail',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
  ],
  providers: [MessageService],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './admin-batch-detail.html',
})
export class AdminBatchDetailPage {
  private readonly adminDb = inject(AdminDbService);
  private readonly route = inject(ActivatedRoute);
  private readonly messageService = inject(MessageService);

  protected readonly db = this.adminDb.db;
  protected readonly dirty = this.adminDb.dirty;
  protected readonly selectedProductId = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly launchMode = signal<'live' | 'scheduled'>('scheduled');

  private readonly batchId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('batchId') ?? '')),
    { initialValue: '' },
  );

  protected readonly batch = computed(() => {
    const id = this.batchId();
    const d = this.db();
    if (!d || !id) {
      return null;
    }
    return d.batches.find((b) => b.id === id) ?? null;
  });

  protected readonly product = computed(() => {
    const b = this.batch();
    const pid = this.selectedProductId();
    if (!b || !pid) {
      return null;
    }
    return b.products.find((p) => p.id === pid) ?? null;
  });

  protected readonly journeyVideo = computed((): JourneyVideoRow | null => {
    const id = this.batchId();
    const d = this.db();
    if (!d || !id) {
      return null;
    }
    return d.journeyVideos.find((v) => v.batchId === id) ?? null;
  });

  protected readonly journeyImages = computed((): JourneyImageRow[] => {
    const id = this.batchId();
    const d = this.db();
    if (!d || !id) {
      return [];
    }
    return (d.journeyImages ?? [])
      .filter((im) => im.batchId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  protected readonly highlights = computed((): HeroHighlightImageRow[] => {
    const id = this.batchId();
    const d = this.db();
    if (!d || !id) {
      return [];
    }
    return (d.heroHighlightImages ?? [])
      .filter((im) => im.batchId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  protected readonly isActive = computed(() => {
    const b = this.batch();
    const d = this.db();
    return !!(b && d && b.id === d.site.activeBatchId);
  });

  protected readonly isPersisted = computed(() => {
    const id = this.batchId();
    return !!id && this.adminDb.isBatchPersisted(id);
  });

  protected readonly scheduleStatus = computed(() => {
    const b = this.batch();
    return b ? getBatchScheduleStatus(b.launchAt) : 'scheduled';
  });

  protected readonly hasBatchImages = computed(() => this.highlights().length > 0);

  private notify(severity: 'success' | 'error' | 'info' | 'warn', summary: string, detail: string, life = 3500): void {
    this.messageService.add({ severity, summary, detail, life });
  }

  protected launchDateValue(iso: string): Date | null {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  protected dateInputValue(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  protected launchTimeValue(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '18:00';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  protected onLaunchDate(date: Date | null): void {
    if (!date) {
      return;
    }
    const existing = this.batch()?.launchAt ? new Date(this.batch()!.launchAt) : null;
    const merged = new Date(date);
    if (existing && !Number.isNaN(existing.getTime())) {
      merged.setHours(existing.getHours(), existing.getMinutes(), 0, 0);
    } else {
      merged.setHours(18, 0, 0, 0);
    }
    this.patchBatch({ launchAt: merged.toISOString() });
    this.formError.set(null);
    this.launchMode.set(this.scheduleStatus() === 'live' ? 'live' : 'scheduled');
  }

  protected onLaunchDateInput(value: string): void {
    if (!value) {
      return;
    }
    const current = this.batch()?.launchAt ? new Date(this.batch()!.launchAt) : null;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (current && !Number.isNaN(current.getTime())) {
      parsed.setHours(current.getHours(), current.getMinutes(), 0, 0);
    } else {
      parsed.setHours(18, 0, 0, 0);
    }
    this.patchBatch({ launchAt: parsed.toISOString() });
    this.formError.set(null);
    this.launchMode.set(this.scheduleStatus() === 'live' ? 'live' : 'scheduled');
  }

  protected onLaunchTime(time: string): void {
    if (!time || !/^\d{1,2}:\d{2}/.test(time)) {
      return;
    }
    const [hh, mm] = time.split(':').map((x) => Number(x));
    const existing = this.batch()?.launchAt ? new Date(this.batch()!.launchAt) : new Date();
    const base = Number.isNaN(existing.getTime()) ? new Date() : new Date(existing);
    base.setHours(hh, mm, 0, 0);
    this.patchBatch({ launchAt: base.toISOString() });
    this.formError.set(null);
    this.launchMode.set(this.scheduleStatus() === 'live' ? 'live' : 'scheduled');
  }

  private validateBeforeSave(): string | null {
    const b = this.batch();
    if (!b) {
      return 'Batch not found — go back and add the batch again';
    }
    if (!b.label.trim()) {
      return 'Batch label is required';
    }
    if (!isValidLaunchDate(b.launchAt)) {
      return 'Choose a valid launch date and time';
    }
    if (!b.products.length) {
      return 'At least one product is required in this batch';
    }
    if (this.isActive() && !this.highlights().length) {
      return 'Active batch needs at least one highlight image';
    }
    for (const p of b.products) {
      if (!p.name.trim()) {
        return 'Every product needs a name';
      }
      if (!isValidAmount(p.price)) {
        return `“${p.name || 'Product'}” needs a valid price (Rs 0 or more)`;
      }
      if (!p.images.length) {
        return `“${p.name || 'Product'}” needs at least one product image`;
      }
    }
    return null;
  }

  protected save(): void {
    const id = this.batchId();
    if (!id) {
      return;
    }
    const err = this.validateBeforeSave();
    if (err) {
      this.formError.set(err);
      this.notify('error', 'Validation', err, 5000);
      return;
    }
    this.formError.set(null);
    this.adminDb.saveBatch(id).subscribe({
      next: () => {
        const tip = this.hasBatchImages()
          ? 'Batch saved to database'
          : 'Batch saved — add batch images (section 4) before making it active';
        this.notify('success', 'Saved', tip, 4000);
      },
      error: (e) =>
        this.notify('error', 'Save failed', e?.error?.error ?? e?.message ?? 'Save failed', 6000),
    });
  }

  protected patchBatch(patch: Partial<BatchRow>): void {
    const b = this.batch();
    if (!b) {
      return;
    }
    this.adminDb.upsertBatch({ ...b, ...patch });
  }

  protected addProduct(): void {
    const b = this.batch();
    if (!b) {
      return;
    }
    const p = this.adminDb.createEmptyProduct(b.id);
    this.adminDb.upsertProduct(b.id, p);
    this.selectedProductId.set(p.id);
  }

  protected selectProduct(id: string): void {
    this.selectedProductId.set(id);
  }

  protected patchProduct(patch: Partial<ProductRow>): void {
    const b = this.batch();
    const p = this.product();
    if (!b || !p) {
      return;
    }
    this.adminDb.upsertProduct(b.id, { ...p, ...patch });
    this.formError.set(null);
  }

  protected onPriceChange(raw: string | number): void {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.]/g, ''));
    this.patchProduct({ price: Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0 });
  }

  protected deleteProduct(): void {
    const b = this.batch();
    const p = this.product();
    if (!b || !p || !confirm(`Delete product “${p.name}”?`)) {
      return;
    }
    this.adminDb.deleteProductRemote(b.id, p.id).subscribe({
      next: () => {
        this.selectedProductId.set(null);
        this.notify('success', 'Deleted', 'Product deleted', 2500);
      },
      error: (err) =>
        this.notify('error', 'Delete failed', err?.error?.error ?? err?.message ?? 'Delete failed', 5000),
    });
  }

  protected addColor(): void {
    const p = this.product();
    if (!p) {
      return;
    }
    const colors: ProductColorEmbedded[] = [
      ...p.colors,
      {
        id: `color-${Date.now().toString(36)}`,
        name: 'New color',
        hex: '#c4a484',
        sortOrder: p.colors.length + 1,
      },
    ];
    this.patchProduct({ colors });
  }

  protected updateColor(index: number, patch: Partial<ProductColorEmbedded>): void {
    const p = this.product();
    if (!p) {
      return;
    }
    const colors = structuredClone(p.colors);
    colors[index] = { ...colors[index], ...patch };
    this.patchProduct({ colors });
  }

  protected removeColor(index: number): void {
    const p = this.product();
    if (!p) {
      return;
    }
    const colors = p.colors.filter((_, i) => i !== index).map((c, i) => ({ ...c, sortOrder: i + 1 }));
    this.patchProduct({ colors });
  }

  protected async onUploadProductImages(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    const p = this.product();
    if (!files?.length || !p) {
      return;
    }
    this.uploading.set(true);
    try {
      const start = p.images.length;
      const uploaded: ProductImageEmbedded[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          continue;
        }
        const media = await firstValueFrom(this.adminDb.uploadFile(file));
        uploaded.push({
          id: `img-${Date.now().toString(36)}-${i}`,
          url: media.publicUrl,
          mediaId: media.id,
          sortOrder: start + uploaded.length + 1,
        });
      }
      if (uploaded.length) {
        this.patchProduct({ images: [...p.images, ...uploaded] });
        this.notify('success', 'Uploaded', `Uploaded ${uploaded.length} product image(s)`, 2500);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Upload failed';
      this.notify('error', 'Upload failed', msg, 5000);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  protected removeProductImage(index: number): void {
    const p = this.product();
    if (!p) {
      return;
    }
    const images = p.images.filter((_, i) => i !== index).map((im, i) => ({ ...im, sortOrder: i + 1 }));
    this.patchProduct({ images });
  }

  protected patchJourneyVideo(patch: Partial<JourneyVideoRow>): void {
    const id = this.batchId();
    if (!id) {
      return;
    }
    this.adminDb.upsertJourneyVideoForBatch(id, patch);
  }

  protected ensureJourneyVideo(): void {
    const id = this.batchId();
    if (!id || this.journeyVideo()) {
      return;
    }
    this.adminDb.upsertJourneyVideoForBatch(id, {
      title: 'Process film',
      lede: '',
      posterImage: '',
      videoUrl: '',
    });
  }

  protected clearJourneyVideo(): void {
    const id = this.batchId();
    if (!id || !confirm('Remove this batch’s journey video?')) {
      return;
    }
    this.adminDb.clearJourneyVideoForBatch(id);
  }

  protected async onUploadJourneyPoster(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file?.type.startsWith('image/')) {
      return;
    }
    this.ensureJourneyVideo();
    try {
      const media = await firstValueFrom(this.adminDb.uploadFile(file));
      this.patchJourneyVideo({
        posterImage: media.publicUrl,
        posterMediaId: media.id,
      });
    } catch {
      this.notify('error', 'Poster upload failed', 'Poster upload failed', 4000);
    }
  }

  protected async onUploadJourneyVideoFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file || !file.type.startsWith('video/')) {
      this.notify('info', 'Choose a video', 'Choose a video file (or paste a YouTube embed URL)', 2500);
      return;
    }
    this.ensureJourneyVideo();
    try {
      const media = await firstValueFrom(this.adminDb.uploadFile(file));
      this.patchJourneyVideo({
        videoUrl: media.publicUrl,
        videoMediaId: media.id,
      });
      this.notify('success', 'Uploaded', 'Video uploaded — click Save', 2500);
    } catch {
      this.notify('error', 'Video upload failed', 'Video upload failed', 4000);
    }
  }

  protected async onUploadJourneyImages(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    const batchId = this.batchId();
    if (!files?.length || !batchId) {
      return;
    }
    this.uploading.set(true);
    try {
      const start = this.journeyImages().length;
      let n = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          continue;
        }
        const media = await firstValueFrom(this.adminDb.uploadFile(file));
        this.adminDb.addJourneyImage({
          batchId,
          url: media.publicUrl,
          mediaId: media.id,
          alt: file.name,
          sortOrder: start + n + 1,
        });
        n++;
      }
      if (n) {
        this.notify('success', 'Uploaded', `Uploaded ${n} journey image(s)`, 2500);
      }
    } catch {
      this.notify('error', 'Upload failed', 'Journey image upload failed', 4000);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  protected updateJourneyImageAlt(id: string, alt: string): void {
    this.adminDb.updateJourneyImage(id, { alt });
  }

  protected removeJourneyImage(id: string): void {
    this.adminDb.removeJourneyImage(id);
  }

  protected async onUploadHighlights(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    const batchId = this.batchId();
    if (!files?.length || !batchId) {
      return;
    }
    this.uploading.set(true);
    try {
      const start = this.highlights().length;
      let n = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          continue;
        }
        const media = await firstValueFrom(this.adminDb.uploadFile(file));
        this.adminDb.addHeroHighlight({
          batchId,
          url: media.publicUrl,
          mediaId: media.id,
          alt: file.name,
          sortOrder: start + n + 1,
        });
        n++;
      }
      if (n) {
        this.formError.set(null);
        this.notify('success', 'Uploaded', `Uploaded ${n} batch image(s)`, 2500);
      }
    } catch {
      this.notify('error', 'Upload failed', 'Highlight upload failed', 4000);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  protected updateHighlightAlt(id: string, alt: string): void {
    this.adminDb.updateHeroHighlight(id, { alt });
  }

  protected removeHighlight(id: string): void {
    this.adminDb.removeHeroHighlight(id);
  }

  protected setActive(): void {
    const b = this.batch();
    if (!b) {
      return;
    }
    if (!this.isPersisted()) {
      this.formError.set('Save this scheduled batch to the database before showing it on the website');
      this.notify('info', 'Save required', 'Save the batch first, then choose Show on website.', 4500);
      return;
    }
    if (!this.highlights().length) {
      this.formError.set('Upload at least one batch image before making this batch active');
      this.notify('error', 'Image required', 'Upload batch images first (section 4)', 4500);
      return;
    }
    this.adminDb.updateSite({ activeBatchId: b.id });
    this.adminDb.saveActiveBatch().subscribe({
      next: () => this.notify('success', 'Updated', 'This batch is now active', 2500),
      error: (err) =>
        this.notify('error', 'Could not set active', err?.error?.error ?? err?.message ?? 'Could not set active', 5000),
    });
  }

  protected setLiveNow(): void {
    const b = this.batch();
    if (!b) {
      return;
    }
    const confirmed = confirm('Launch this batch immediately? Click Yes to set the launch time to now.');
    if (!confirmed) {
      return;
    }
    const now = new Date();
    this.patchBatch({ launchAt: now.toISOString() });
    this.formError.set(null);
    this.launchMode.set('live');
    this.notify('success', 'Live status', 'Batch time updated to live now. Save to persist.', 3000);
  }

  protected setScheduled(): void {
    const b = this.batch();
    if (!b) {
      return;
    }
    const confirmed = confirm('Schedule this batch for later? Click Yes to move the launch to tomorrow.');
    if (!confirmed) {
      return;
    }
    const next = new Date(b.launchAt || Date.now());
    if (Number.isNaN(next.getTime()) || next.getTime() <= Date.now()) {
      next.setTime(Date.now());
    }
    next.setDate(next.getDate() + 1);
    this.patchBatch({ launchAt: next.toISOString() });
    this.launchMode.set('scheduled');
    this.notify('info', 'Scheduled', 'Launch moved to tomorrow at the selected time. Save to persist.', 3000);
  }

  protected isDataUrl(url: string): boolean {
    return url.startsWith('data:');
  }
}

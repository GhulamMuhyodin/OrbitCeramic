import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  protected readonly db = this.adminDb.db;
  protected readonly dirty = this.adminDb.dirty;
  protected readonly selectedProductId = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly launchMode = signal<'live' | 'scheduled'>('scheduled');
  protected readonly pendingProductFiles = signal<Record<string, { id: string; file: File }[]>>({});
  protected readonly pendingJourneyFiles = signal<{ id: string; batchId: string; file: File }[]>([]);
  protected readonly pendingHighlightFiles = signal<{ id: string; batchId: string; file: File }[]>([]);
  /** Soft-delete markers — applied on Save, not immediately. */
  protected readonly deletedProductImageIds = signal<Record<string, Record<string, true>>>({});
  protected readonly deletedJourneyImageIds = signal<Record<string, true>>({});
  protected readonly deletedHighlightIds = signal<Record<string, true>>({});
  protected pendingJourneyPosterFile: File | null = null;
  protected pendingJourneyVideoFile: File | null = null;

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

  /** Single-item list so @for can track by id and keep inputs stable while editing. */
  protected readonly productEditorRows = computed(() => {
    const p = this.product();
    return p ? [p] : [];
  });

  private readonly autoSelectProduct = effect(() => {
    const b = this.batch();
    const selected = this.selectedProductId();
    if (!b?.products.length) {
      return;
    }
    if (selected && b.products.some((p) => p.id === selected)) {
      return;
    }
    this.selectedProductId.set(b.products[0].id);
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

  /**
   * Only persisted LIVE batches are locked.
   * Unsaved drafts stay fully editable even if launch is set to “now” / today.
   */
  protected readonly isReadOnly = computed(
    () => this.isPersisted() && this.scheduleStatus() === 'live',
  );

  protected readonly hasBatchImages = computed(() => {
    const deleted = this.deletedHighlightIds();
    return this.highlights().some((h) => !deleted[h.id]);
  });

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

  protected formatLaunchDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  protected syncLaunchDisplay(launchAt: string, date: Date): void {
    const launchDisplay = this.formatLaunchDisplay(date);
    this.patchBatch({ launchAt: launchAt, launchDisplay });
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
    this.syncLaunchDisplay(merged.toISOString(), merged);
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
    this.syncLaunchDisplay(parsed.toISOString(), parsed);
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
    this.syncLaunchDisplay(base.toISOString(), base);
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
    if (this.isActive() && !this.hasBatchImages()) {
      return 'Active batch needs at least one highlight image';
    }
    for (const p of b.products) {
      if (!p.name.trim()) {
        return 'Every product needs a name';
      }
      if (!isValidAmount(p.price)) {
        return `“${p.name || 'Product'}” needs a valid price (Rs 0 or more)`;
      }
      const deleted = this.deletedProductImageIds()[p.id] ?? {};
      const visibleImages = p.images.filter((img) => !deleted[img.id]);
      if (!visibleImages.length) {
        return `“${p.name || 'Product'}” needs at least one product image`;
      }
    }
    return null;
  }

  protected async save(): Promise<void> {
    const id = this.batchId();
    if (!id) {
      return;
    }
    if (this.isReadOnly()) {
      const msg = 'This batch is currently LIVE and cannot be modified.';
      this.formError.set(msg);
      this.notify('warn', 'Read only', msg, 5000);
      return;
    }
    const err = this.validateBeforeSave();
    if (err) {
      this.formError.set(err);
      this.notify('error', 'Validation', err, 5000);
      return;
    }
    this.formError.set(null);
    this.uploading.set(true);
    try {
      const formData = this.buildBatchSaveFormData();
      await firstValueFrom(this.adminDb.saveBatchMultipart(id, formData));
      this.clearPendingImageState();
      const tip = this.hasBatchImages()
        ? 'Batch saved to database'
        : 'Batch saved — add batch images (section 4) before making it active';
      this.notify('success', 'Saved', tip, 4000);
      void this.router.navigate(['/admin/batches']);
    } catch (e) {
      const message =
        e && typeof e === 'object' && 'error' in e && (e as { error?: { error?: string } }).error?.error
          ? String((e as { error: { error: string } }).error.error)
          : e && typeof e === 'object' && 'message' in e
            ? String((e as { message: string }).message)
            : 'Save failed';
      this.notify('error', 'Save failed', message, 6000);
    } finally {
      this.uploading.set(false);
    }
  }

  protected patchBatch(patch: Partial<BatchRow>): void {
    if (this.isReadOnly()) {
      return;
    }
    const b = this.batch();
    if (!b) {
      return;
    }
    this.adminDb.upsertBatch({ ...b, ...patch });
  }

  protected onBatchSoldOutChange(soldOut: boolean): void {
    if (this.isReadOnly()) {
      const id = this.batchId();
      const b = this.batch();
      if (!id || !b) {
        return;
      }
      const snapshot = structuredClone(b);
      this.adminDb.upsertBatch({
        ...b,
        soldOut,
        products: b.products.map((product) => ({ ...product, soldOut })),
      });
      this.adminDb.dirty.set(false);
      this.adminDb.setBatchSoldOut(id, soldOut).subscribe({
        next: () => this.notify('success', 'Saved', 'Sold-out status updated', 2500),
        error: (err) => {
          this.adminDb.upsertBatch(snapshot);
          this.adminDb.dirty.set(false);
          this.notify(
            'error',
            'Save failed',
            err?.error?.error ?? err?.message ?? 'Unable to update sold-out status',
            5000,
          );
        },
      });
      return;
    }
    this.patchBatch({ soldOut });
  }

  protected onProductSoldOutChange(soldOut: boolean): void {
    if (this.isReadOnly()) {
      const batchId = this.batchId();
      const p = this.product();
      if (!batchId || !p) {
        return;
      }
      const snapshot = structuredClone(p);
      this.adminDb.upsertProduct(batchId, { ...p, soldOut });
      this.adminDb.dirty.set(false);
      this.adminDb.setProductSoldOut(batchId, p.id, soldOut).subscribe({
        next: () => this.notify('success', 'Saved', 'Product sold-out status updated', 2500),
        error: (err) => {
          this.adminDb.upsertProduct(batchId, snapshot);
          this.adminDb.dirty.set(false);
          this.notify(
            'error',
            'Save failed',
            err?.error?.error ?? err?.message ?? 'Unable to update sold-out status',
            5000,
          );
        },
      });
      return;
    }
    this.patchProduct({ soldOut });
  }

  private patchProductImage(productId: string, imageId: string, patch: Partial<ProductImageEmbedded>): void {
    const batch = this.batch();
    if (!batch) {
      return;
    }
    const product = batch.products.find((p) => p.id === productId);
    if (!product) {
      return;
    }
    const images = product.images.map((img) => (img.id === imageId ? { ...img, ...patch } : img));
    this.adminDb.upsertProduct(batch.id, { ...product, images });
  }

  private revokePreviewUrl(url: string): void {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  private buildBatchSaveFormData(): FormData {
    const id = this.batchId();
    const db = this.db();
    const batch = id && db ? db.batches.find((b) => b.id === id) : null;
    if (!id || !db || !batch) {
      throw new Error('Batch data is not available for save');
    }

    type PendingImagePayload = ProductImageEmbedded & { fileKey?: string };
    type PendingJourneyImagePayload = JourneyImageRow & { fileKey?: string };
    type PendingHighlightPayload = HeroHighlightImageRow & { fileKey?: string };

    const journeyVideo = db.journeyVideos.find((v) => v.batchId === id) ?? null;
    const journeyImages = (db.journeyImages ?? []).filter((im) => im.batchId === id);
    const highlights = (db.heroHighlightImages ?? []).filter((h) => h.batchId === id);

    const buildProductImages = (product: ProductRow): PendingImagePayload[] => {
      const deleted = this.deletedProductImageIds()[product.id] ?? {};
      return product.images
        .filter((img) => !deleted[img.id])
        .map((img) => {
          const pending = (this.pendingProductFiles()[product.id] ?? []).find((item) => item.id === img.id);
          return pending ? { ...img, fileKey: `product_image_${product.id}_${img.id}` } : img;
        });
    };

    const payload = {
      batch: {
        id: batch.id,
        label: batch.label,
        launchAt: batch.launchAt,
        launchDisplay: batch.launchDisplay,
        soldOut: batch.soldOut,
        sortOrder: batch.sortOrder,
        heroWindowDays: batch.heroWindowDays ?? 10,
      },
      products: batch.products.map((product) => ({
        ...product,
        batchId: id,
        images: buildProductImages(product),
      })),
      journey: {
        video: journeyVideo
          ? {
              id: journeyVideo.id,
              title: journeyVideo.title,
              lede: journeyVideo.lede,
              posterImage: journeyVideo.posterImage,
              videoUrl: journeyVideo.videoUrl,
              posterMediaId: journeyVideo.posterMediaId,
              videoMediaId: journeyVideo.videoMediaId,
              ...(this.pendingJourneyPosterFile ? { posterFileKey: 'journey_poster_file' } : {}),
              ...(this.pendingJourneyVideoFile ? { videoFileKey: 'journey_video_file' } : {}),
            }
          : null,
        images: journeyImages
          .filter((image) => !this.deletedJourneyImageIds()[image.id])
          .map((image) => {
            const pending = this.pendingJourneyFiles().find((item) => item.id === image.id);
            return pending ? { ...image, fileKey: `journey_image_${image.id}` } : image;
          }),
      },
      highlights: highlights
        .filter((highlight) => !this.deletedHighlightIds()[highlight.id])
        .map((highlight) => {
          const pending = this.pendingHighlightFiles().find((item) => item.id === highlight.id);
          return pending ? { ...highlight, fileKey: `highlight_image_${highlight.id}` } : highlight;
        }),
    };

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));

    for (const product of batch.products) {
      const productPayload = payload.products.find((p: any) => p.id === product.id) as {
        images: PendingImagePayload[];
      } | null;
      if (!productPayload) {
        continue;
      }
      for (const img of productPayload.images) {
        if (img.fileKey) {
          const pending = (this.pendingProductFiles()[product.id] ?? []).find((item) => item.id === img.id);
          if (pending) {
            formData.append(img.fileKey, pending.file, pending.file.name);
          }
        }
      }
    }

    for (const pending of this.pendingJourneyFiles()) {
      formData.append(`journey_image_${pending.id}`, pending.file, pending.file.name);
    }

    if (this.pendingJourneyPosterFile) {
      formData.append('journey_poster_file', this.pendingJourneyPosterFile, this.pendingJourneyPosterFile.name);
    }

    if (this.pendingJourneyVideoFile) {
      formData.append('journey_video_file', this.pendingJourneyVideoFile, this.pendingJourneyVideoFile.name);
    }

    for (const pending of this.pendingHighlightFiles()) {
      formData.append(`highlight_image_${pending.id}`, pending.file, pending.file.name);
    }

    return formData;
  }

  protected isPreviewUrl(url: string): boolean {
    return url.startsWith('blob:');
  }

  protected addProduct(): void {
    if (this.isReadOnly()) {
      return;
    }
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
    if (this.isReadOnly()) {
      return;
    }
    const b = this.batch();
    const productId = this.selectedProductId();
    if (!b || !productId) {
      return;
    }
    const p = b.products.find((item) => item.id === productId);
    if (!p) {
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
    if (this.isReadOnly()) {
      return;
    }
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
    if (this.isReadOnly()) {
      return;
    }
    const input = event.target as HTMLInputElement;
    const files = input.files;
    const p = this.product();
    if (!files?.length || !p) {
      return;
    }
    const start = p.images.length;
    const pendingItems = this.pendingProductFiles()[p.id] ?? [];
    const updatedImages: ProductImageEmbedded[] = [];
    const pendingEntries = [] as { id: string; file: File }[];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        continue;
      }
      const imageId = `img-${Date.now().toString(36)}-${start + i}-${Math.random().toString(36).slice(2, 7)}`;
      pendingEntries.push({ id: imageId, file });
      updatedImages.push({
        id: imageId,
        url: URL.createObjectURL(file),
        sortOrder: start + updatedImages.length + 1,
      });
    }
    if (updatedImages.length) {
      this.pendingProductFiles.set({
        ...this.pendingProductFiles(),
        [p.id]: [...pendingItems, ...pendingEntries],
      });
      this.patchProduct({ images: [...p.images, ...updatedImages] });
      this.notify('info', 'Staged', `Product image(s) staged for save`, 2500);
    }
    input.value = '';
  }

  protected removeProductImage(index: number): void {
    if (this.isReadOnly()) {
      return;
    }
    const b = this.batch();
    const p = this.product();
    if (!b || !p) {
      return;
    }
    const imageToRemove = p.images[index];
    if (!imageToRemove) {
      return;
    }
    if (this.isNewImage(imageToRemove)) {
      const images = p.images.filter((_, i) => i !== index).map((im, i) => ({ ...im, sortOrder: i + 1 }));
      this.adminDb.upsertProduct(b.id, { ...p, images });
      this.removePendingProductFile(p.id, imageToRemove.id);
      this.revokePreviewUrl(imageToRemove.url);
      return;
    }
    if (this.isProductImageDeleted(p.id, imageToRemove.id)) {
      this.restoreProductImage(p.id, imageToRemove.id);
      return;
    }
    this.markProductImageDeleted(p.id, imageToRemove.id);
    this.adminDb.markDirty();
  }

  protected patchJourneyVideo(patch: Partial<JourneyVideoRow>): void {
    if (this.isReadOnly()) {
      return;
    }
    const id = this.batchId();
    if (!id) {
      return;
    }
    this.adminDb.upsertJourneyVideoForBatch(id, patch);
  }

  protected ensureJourneyVideo(): void {
    if (this.isReadOnly()) {
      return;
    }
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
    if (this.isReadOnly()) {
      return;
    }
    const id = this.batchId();
    if (!id || !confirm('Remove this batch’s journey video?')) {
      return;
    }
    this.adminDb.clearJourneyVideoForBatch(id);
  }

  protected async onUploadJourneyPoster(event: Event): Promise<void> {
    if (this.isReadOnly()) {
      return;
    }
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file?.type.startsWith('image/')) {
      return;
    }
    this.ensureJourneyVideo();
    this.pendingJourneyPosterFile = file;
    this.patchJourneyVideo({ posterImage: URL.createObjectURL(file), posterMediaId: undefined });
    this.notify('info', 'Staged', 'Journey poster staged for save', 2500);
  }

  protected async onUploadJourneyVideoFile(event: Event): Promise<void> {
    if (this.isReadOnly()) {
      return;
    }
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file || !file.type.startsWith('video/')) {
      this.notify('info', 'Choose a video', 'Choose a video file (or paste a YouTube embed URL)', 2500);
      return;
    }
    this.ensureJourneyVideo();
    this.pendingJourneyVideoFile = file;
    this.patchJourneyVideo({ videoUrl: URL.createObjectURL(file), videoMediaId: undefined });
    this.notify('info', 'Staged', 'Journey video staged for save', 2500);
  }

  protected async onUploadJourneyImages(event: Event): Promise<void> {
    if (this.isReadOnly()) {
      return;
    }
    const input = event.target as HTMLInputElement;
    const files = input.files;
    const batchId = this.batchId();
    if (!files?.length || !batchId) {
      return;
    }
    const start = this.journeyImages().length;
    let n = 0;
    const pending = this.pendingJourneyFiles();
    const updated = [...pending];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        continue;
      }
      const imageId = `ji-${Date.now().toString(36)}-${start + n}-${Math.random().toString(36).slice(2, 7)}`;
      updated.push({ id: imageId, batchId, file });
      this.adminDb.addJourneyImage({
        batchId,
        id: imageId,
        url: URL.createObjectURL(file),
        alt: file.name,
        sortOrder: start + n + 1,
      });
      n++;
    }
    if (n) {
      this.pendingJourneyFiles.set(updated);
      this.notify('info', 'Staged', `Journey image(s) staged for save`, 2500);
    }
    input.value = '';
  }

  protected updateJourneyImageAlt(id: string, alt: string): void {
    if (this.isReadOnly()) {
      return;
    }
    this.adminDb.updateJourneyImage(id, { alt });
  }

  protected removeJourneyImage(id: string): void {
    if (this.isReadOnly()) {
      return;
    }
    const current = this.journeyImages().find((img) => img.id === id);
    if (!current) {
      return;
    }
    if (this.isNewImage(current)) {
      this.revokePreviewUrl(current.url);
      this.adminDb.removeJourneyImage(id);
      this.removePendingJourneyFile(id);
      return;
    }
    if (this.deletedJourneyImageIds()[id]) {
      this.restoreJourneyImage(id);
      return;
    }
    this.deletedJourneyImageIds.set({ ...this.deletedJourneyImageIds(), [id]: true });
    this.adminDb.markDirty();
  }

  protected async onUploadHighlights(event: Event): Promise<void> {
    if (this.isReadOnly()) {
      return;
    }
    const input = event.target as HTMLInputElement;
    const files = input.files;
    const batchId = this.batchId();
    if (!files?.length || !batchId) {
      return;
    }
    const start = this.highlights().length;
    let n = 0;
    const pending = this.pendingHighlightFiles();
    const updated = [...pending];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        continue;
      }
      const imageId = `hh-${Date.now().toString(36)}-${start + n}-${Math.random().toString(36).slice(2, 7)}`;
      updated.push({ id: imageId, batchId, file });
      this.adminDb.addHeroHighlight({
        batchId,
        id: imageId,
        url: URL.createObjectURL(file),
        alt: file.name,
        sortOrder: start + n + 1,
      });
      n++;
    }
    if (n) {
      this.pendingHighlightFiles.set(updated);
      this.formError.set(null);
      this.notify('info', 'Staged', `Batch image(s) staged for save`, 2500);
    }
    input.value = '';
  }

  protected updateHighlightAlt(id: string, alt: string): void {
    if (this.isReadOnly()) {
      return;
    }
    this.adminDb.updateHeroHighlight(id, { alt });
  }

  protected removeHighlight(id: string): void {
    if (this.isReadOnly()) {
      return;
    }
    const current = this.highlights().find((img) => img.id === id);
    if (!current) {
      return;
    }
    if (this.isNewImage(current)) {
      this.revokePreviewUrl(current.url);
      this.adminDb.removeHeroHighlight(id);
      this.removePendingHighlightFile(id);
      return;
    }
    if (this.deletedHighlightIds()[id]) {
      this.restoreHighlight(id);
      return;
    }
    this.deletedHighlightIds.set({ ...this.deletedHighlightIds(), [id]: true });
    this.adminDb.markDirty();
  }

  private removePendingProductFile(productId: string, imageId: string): void {
    const pending = this.pendingProductFiles();
    if (!pending[productId]) {
      return;
    }
    const remaining = pending[productId].filter((item) => item.id !== imageId);
    this.pendingProductFiles.set({
      ...pending,
      [productId]: remaining,
    });
  }

  private removePendingJourneyFile(imageId: string): void {
    this.pendingJourneyFiles.set(this.pendingJourneyFiles().filter((item) => item.id !== imageId));
  }

  private removePendingHighlightFile(imageId: string): void {
    this.pendingHighlightFiles.set(this.pendingHighlightFiles().filter((item) => item.id !== imageId));
  }

  protected isNewImage(image: { id: string; url: string; mediaId?: string }): boolean {
    return !image.mediaId || image.url.startsWith('blob:') || image.url.startsWith('data:');
  }

  protected isProductImageDeleted(productId: string, imageId: string): boolean {
    return !!this.deletedProductImageIds()[productId]?.[imageId];
  }

  protected imageBadge(
    image: { id: string; url: string; mediaId?: string },
    kind: 'product' | 'journey' | 'highlight',
    productId?: string,
  ): 'new' | 'existing' | 'deleted' {
    if (kind === 'product' && productId && this.isProductImageDeleted(productId, image.id)) {
      return 'deleted';
    }
    if (kind === 'journey' && this.deletedJourneyImageIds()[image.id]) {
      return 'deleted';
    }
    if (kind === 'highlight' && this.deletedHighlightIds()[image.id]) {
      return 'deleted';
    }
    return this.isNewImage(image) ? 'new' : 'existing';
  }

  private markProductImageDeleted(productId: string, imageId: string): void {
    const current = this.deletedProductImageIds();
    this.deletedProductImageIds.set({
      ...current,
      [productId]: { ...(current[productId] ?? {}), [imageId]: true },
    });
  }

  private restoreProductImage(productId: string, imageId: string): void {
    const current = { ...this.deletedProductImageIds() };
    const productMap = { ...(current[productId] ?? {}) };
    delete productMap[imageId];
    if (Object.keys(productMap).length === 0) {
      delete current[productId];
    } else {
      current[productId] = productMap;
    }
    this.deletedProductImageIds.set(current);
    this.adminDb.markDirty();
  }

  private restoreJourneyImage(imageId: string): void {
    const current = { ...this.deletedJourneyImageIds() };
    delete current[imageId];
    this.deletedJourneyImageIds.set(current);
    this.adminDb.markDirty();
  }

  private restoreHighlight(imageId: string): void {
    const current = { ...this.deletedHighlightIds() };
    delete current[imageId];
    this.deletedHighlightIds.set(current);
    this.adminDb.markDirty();
  }

  private clearPendingImageState(): void {
    this.pendingProductFiles.set({});
    this.pendingJourneyFiles.set([]);
    this.pendingHighlightFiles.set([]);
    this.deletedProductImageIds.set({});
    this.deletedJourneyImageIds.set({});
    this.deletedHighlightIds.set({});
    this.pendingJourneyPosterFile = null;
    this.pendingJourneyVideoFile = null;
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
    if (!this.hasBatchImages()) {
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
    if (this.isReadOnly()) {
      return;
    }
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
    if (this.isReadOnly()) {
      return;
    }
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

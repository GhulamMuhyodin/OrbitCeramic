import { Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../../directives/reveal';
import {
  JourneyBatchCard,
  JourneyPageCopy,
  JourneyVideoRow,
} from '../../data/site-content.model';

@Component({
  selector: 'app-journey',
  imports: [RevealDirective, RouterLink],
  host: { class: 'block' },
  templateUrl: './journey.html',
})
export class Journey {
  private readonly sanitizer = inject(DomSanitizer);

  readonly content = input.required<JourneyPageCopy>();
  readonly cards = input.required<JourneyBatchCard[]>();

  protected readonly activeCard = signal<JourneyBatchCard | null>(null);
  protected readonly playingVideoId = signal<string | null>(null);
  protected readonly playingEmbedUrl = signal<SafeResourceUrl | null>(null);

  protected readonly isEmpty = computed(() => this.cards().length === 0);

  protected openCard(card: JourneyBatchCard): void {
    this.activeCard.set(card);
    this.stopVideo();
  }

  protected backToCards(): void {
    this.activeCard.set(null);
    this.stopVideo();
  }

  protected play(video: JourneyVideoRow): void {
    this.playingVideoId.set(video.id);
    this.playingEmbedUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(video.videoUrl),
    );
  }

  protected isPlaying(videoId: string): boolean {
    return this.playingVideoId() === videoId;
  }

  private stopVideo(): void {
    this.playingVideoId.set(null);
    this.playingEmbedUrl.set(null);
  }
}

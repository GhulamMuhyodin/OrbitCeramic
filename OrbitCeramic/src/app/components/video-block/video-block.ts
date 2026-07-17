import { Component, input, signal } from '@angular/core';
import { RevealDirective } from '../../directives/reveal';
import { VideoContent } from '../../data/site-content.model';

@Component({
  selector: 'app-video-block',
  imports: [RevealDirective],
  templateUrl: './video-block.html',
  styleUrl: './video-block.css',
})
export class VideoBlock {
  readonly content = input.required<VideoContent>();
  protected readonly playing = signal(false);

  protected play(): void {
    this.playing.set(true);
  }
}

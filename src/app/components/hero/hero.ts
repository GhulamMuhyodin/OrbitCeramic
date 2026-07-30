import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeroContent, HeroHighlightBatch } from '../../data/site-content.model';

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  host: { class: 'block' },
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  readonly content = input.required<HeroContent>();
  readonly highlights = input<HeroHighlightBatch[]>([]);

  protected statusLabel(status: HeroHighlightBatch['status']): string {
    switch (status) {
      case 'scheduled':
        return 'Upcoming';
      case 'live':
        return 'Live';
      case 'recent':
        return 'Recently launched';
    }
  }
}

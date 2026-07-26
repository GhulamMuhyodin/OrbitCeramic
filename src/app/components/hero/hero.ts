import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeroContent } from '../../data/site-content.model';

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  host: { class: 'block' },
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  readonly content = input.required<HeroContent>();
}

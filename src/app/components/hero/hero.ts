import { Component, input } from '@angular/core';
import { HeroContent } from '../../data/site-content.model';

@Component({
  selector: 'app-hero',
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  readonly content = input.required<HeroContent>();
}

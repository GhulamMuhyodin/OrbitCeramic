import { Component, input } from '@angular/core';
import { RevealDirective } from '../../directives/reveal';
import { AboutContent } from '../../data/site-content.model';

@Component({
  selector: 'app-about',
  imports: [RevealDirective],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  readonly content = input.required<AboutContent>();
}

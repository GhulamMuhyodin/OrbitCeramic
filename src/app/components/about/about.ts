import { Component, input } from '@angular/core';
import { RevealDirective } from '../../directives/reveal';
import { AboutContent } from '../../data/site-content.model';

@Component({
  selector: 'app-about',
  imports: [RevealDirective],
  host: { class: 'block' },
  templateUrl: './about.html',
})
export class About {
  readonly content = input.required<AboutContent>();
}

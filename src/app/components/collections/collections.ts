import { Component, input } from '@angular/core';
import { RevealDirective } from '../../directives/reveal';
import { CollectionsContent } from '../../data/site-content.model';

@Component({
  selector: 'app-collections',
  imports: [RevealDirective],
  templateUrl: './collections.html',
  styleUrl: './collections.css',
})
export class Collections {
  readonly content = input.required<CollectionsContent>();
}

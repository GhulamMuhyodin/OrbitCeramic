import { Component, input, signal } from '@angular/core';
import { NavLink } from '../../data/site-content.model';

@Component({
  selector: 'app-site-header',
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
})
export class SiteHeader {
  readonly brand = input.required<string>();
  readonly nav = input.required<NavLink[]>();

  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}

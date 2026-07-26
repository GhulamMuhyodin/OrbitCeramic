import { DOCUMENT, NgClass } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { NavLink } from '../../data/site-content.model';

@Component({
  selector: 'app-site-header',
  imports: [NgClass, RouterLink, RouterLinkActive],
  host: {
    class: 'sticky top-0 z-[70] block w-full',
  },
  templateUrl: './site-header.html',
})
export class SiteHeader {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly brand = input.required<string>();
  readonly nav = input.required<NavLink[]>();
  readonly overlay = input(false);

  protected readonly menuOpen = signal(false);

  constructor() {
    effect(() => {
      this.document.body.style.overflow = this.menuOpen() ? 'hidden' : '';
    });

    this.destroyRef.onDestroy(() => {
      this.document.body.style.overflow = '';
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeMenu());
  }

  protected menuBarClass(isTop: boolean): string {
    const open = this.menuOpen();
    const overlay = this.overlay();
    const parts: string[] = [];

    if (open) {
      // Dark X on light header bar (same as closed non-home header).
      parts.push('bg-stone-900', 'mix-blend-normal');
      parts.push(isTop ? 'translate-y-[3.75px] rotate-45' : '-translate-y-[3.75px] -rotate-45');
    } else if (overlay) {
      parts.push('bg-surface', 'mix-blend-difference');
    } else {
      parts.push('bg-stone-900', 'mix-blend-normal');
    }

    return parts.join(' ');
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}

import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ContactInfo,
  FooterContent,
  contactHref,
} from '../../data/site-content.model';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  host: { class: 'block' },
  templateUrl: './site-footer.html',
})
export class SiteFooter {
  readonly brand = input.required<string>();
  readonly contact = input.required<ContactInfo>();
  readonly content = input.required<FooterContent>();

  protected readonly year = new Date().getFullYear();

  protected linkFor(key: 'instagram' | 'email' | 'website'): string {
    return contactHref(this.contact(), key);
  }
}

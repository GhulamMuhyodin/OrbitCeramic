import { Component, input } from '@angular/core';
import {
  ContactInfo,
  FooterContent,
  contactHref,
} from '../../data/site-content.model';

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.css',
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

export interface NavLink {
  label: string;
  href: string;
}

export interface ContactInfo {
  whatsapp: string;
  email: string;
  instagram: string;
  instagramHandle: string;
  visitLines: string[];
  website: string;
}

export interface HeroContent {
  image: string;
  brand: string;
  title: string;
  lede: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface AboutContent {
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  image: string;
  imageAlt: string;
}

export interface CollectionItem {
  id: string;
  title: string;
  image: string;
  alt: string;
  span: 'wide' | 'tall' | 'normal';
}

export interface CollectionsContent {
  eyebrow: string;
  heading: string;
  lede: string;
  items: CollectionItem[];
}

export interface VideoContent {
  eyebrow: string;
  heading: string;
  lede: string;
  posterImage: string;
  videoUrl: string;
  videoTitle: string;
}

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  description: string;
  alt: string;
  images: string[];
}

export interface BestsellersContent {
  eyebrow: string;
  heading: string;
  lede: string;
  buyLabel: string;
  currency: string;
  currencySymbol: string;
  items: ProductItem[];
}

export interface FooterSocialLink {
  label: string;
  hrefKey: 'instagram' | 'email' | 'website';
}

export interface FooterContent {
  tagline: string;
  visitLabel: string;
  exploreLabel: string;
  followLabel: string;
  exploreLinks: NavLink[];
  socialLinks: FooterSocialLink[];
  copyright: string;
}

export interface SiteContent {
  brand: string;
  contact: ContactInfo;
  nav: NavLink[];
  hero: HeroContent;
  about: AboutContent;
  collections: CollectionsContent;
  video: VideoContent;
  bestsellers: BestsellersContent;
  footer: FooterContent;
}

export function whatsappBuyUrl(
  whatsapp: string,
  brand: string,
  productName: string,
  price: number,
  currencySymbol: string,
): string {
  const formatted = price.toLocaleString('en-PK');
  const message = `Hi ${brand}! I'd like to buy: ${productName} (${currencySymbol} ${formatted}).`;
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

export function contactHref(contact: ContactInfo, key: FooterSocialLink['hrefKey']): string {
  if (key === 'email') {
    return `mailto:${contact.email}`;
  }
  return contact[key];
}

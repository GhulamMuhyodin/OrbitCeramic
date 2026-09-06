/** Shared admin field validation helpers. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
/** E.164-ish: optional +, then 8–15 digits (WhatsApp / phone). */
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

export function isValidEmail(value: string | null | undefined): boolean {
  const v = (value ?? '').trim();
  return v.length > 0 && EMAIL_RE.test(v);
}

export function isValidPhone(value: string | null | undefined): boolean {
  const digits = (value ?? '').replace(/[\s()-]/g, '');
  return PHONE_RE.test(digits);
}

export function isValidAmount(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isValidLaunchDate(iso: string | null | undefined): boolean {
  if (!iso?.trim()) {
    return false;
  }
  const t = Date.parse(iso);
  return !Number.isNaN(t);
}

export function phoneHint(): string {
  return 'Digits only or +country code, e.g. 923001234567';
}

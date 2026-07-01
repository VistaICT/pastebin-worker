import type { RecipientEntry } from './types';
import { normalizeEmail, validateSingleEmail } from '@lockbox/types/validation';

export function validateSingleRecipientEmail(value: string): string | null {
  const result = validateSingleEmail(value);
  if (result === 'required') return 'Recipient email is required';
  if (result === 'multiple') return 'Enter only one email address per recipient';
  if (result === 'invalid') return 'Enter a valid email address';
  return null;
}

export function getRecipientError(value: string): string | null {
  return validateSingleRecipientEmail(value);
}

export function normalizeRecipients(entries: string[]): string[] {
  const deduped = new Map<string, string>();
  for (const raw of entries) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const normalized = normalizeEmail(trimmed);
    if (!deduped.has(normalized)) {
      deduped.set(normalized, trimmed);
    }
  }
  return Array.from(deduped.values());
}

export function hasInvalidRecipient(entries: RecipientEntry[]): boolean {
  return entries.some((entry) => Boolean(validateSingleRecipientEmail(entry.email)));
}

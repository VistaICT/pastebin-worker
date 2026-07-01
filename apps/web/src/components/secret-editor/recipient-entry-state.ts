import type { RecipientEntry } from '@/components/secret-create/types';

export function createRecipientEntry(): RecipientEntry {
  return { id: crypto.randomUUID(), email: '', touched: false };
}

export function addRecipientEntry(entries: RecipientEntry[]): RecipientEntry[] {
  return [...entries, createRecipientEntry()];
}

export function removeRecipientEntryAt(entries: RecipientEntry[], index: number): RecipientEntry[] {
  if (entries.length <= 1) return [createRecipientEntry()];
  return entries.filter((_, i) => i !== index);
}

export function setRecipientEntryAt(entries: RecipientEntry[], index: number, value: string): RecipientEntry[] {
  return entries.map((entry, i) => (
    i === index ? { ...entry, email: value } : entry
  ));
}

export function markRecipientEntryTouched(entries: RecipientEntry[], index: number): RecipientEntry[] {
  return entries.map((entry, i) => (
    i === index ? { ...entry, touched: true } : entry
  ));
}

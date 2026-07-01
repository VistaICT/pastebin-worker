import type { ShareItem } from '@lockbox/types/storage';

// Re-export ShareItem for convenience
export type { ShareItem } from '@lockbox/types/storage';

const STORAGE_KEY = 'lockbox-shares';
const MAX_ITEMS = 100;

export class ShareStorage {
  static getAll(): ShareItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? (JSON.parse(data) as ShareItem[]) : [];
    } catch {
      return [];
    }
  }

  static save(item: Omit<ShareItem, 'id' | 'createdAt' | 'updatedAt'>): ShareItem {
    const all = this.getAll();
    const now = new Date().toISOString();
    const newItem: ShareItem = { ...item, id: Date.now().toString(), createdAt: now, updatedAt: now };
    all.unshift(newItem);
    if (all.length > MAX_ITEMS) all.splice(MAX_ITEMS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      /* storage full — silently fail */
    }
    return newItem;
  }

  static delete(id: string): void {
    const all = this.getAll().filter((i) => i.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

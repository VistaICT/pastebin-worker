/**
 * Local storage types for the web app
 */

export interface ShareItem {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'file';
  language?: string;
  fileName?: string;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
}

import type { AttachmentTransferProgress, SecretAttachment } from '@/service';

export interface AttachmentDraft {
  attachment: SecretAttachment;
}

export interface UploadQueueItem {
  id: string;
  fileName: string;
  size: number;
  status: 'pending' | 'processing' | 'success' | 'error' | 'cancelled';
  progress: AttachmentTransferProgress;
  error?: string;
}

export interface RecipientEntry {
  id: string;
  email: string;
  touched: boolean;
}

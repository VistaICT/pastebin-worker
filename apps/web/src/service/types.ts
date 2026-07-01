import type {
  SecretAttachment,
  SecretEncryptionEnvelope,
  SecretAccessRequirements,
  SecretAccessConfig,
} from '@lockbox/types/api';

export type { SecretAttachment } from '@lockbox/types/api';

export interface SecretResponse {
  id?: string;
  content?: string;
  expire?: number;
  euJurisdiction?: boolean;
  createTime?: number;
  url?: string;
  attachments?: SecretAttachment[];
  encryption?: SecretEncryptionEnvelope | null;
  access?: SecretAccessRequirements;
  code?: number;
  error?: string;
  raw?: string;
}

export interface UploadFileResponse {
  id?: string;
  url?: string;
  expireDays?: number;
  euJurisdiction?: boolean;
  error?: string;
  raw?: string;
}

export type AttachmentTransferStage = 'preparing' | 'encrypting' | 'uploading' | 'downloading' | 'decrypting' | 'finalizing' | 'complete';

export interface AttachmentTransferProgress {
  fileName: string;
  stage: AttachmentTransferStage;
  overallProgress: number;
  completedBytes: number;
  totalBytes: number;
  chunkIndex: number;
  chunkCount: number;
}

export interface AttachmentTransferOptions {
  onProgress?: (progress: AttachmentTransferProgress) => void;
  signal?: AbortSignal;
}

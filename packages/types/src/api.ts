/**
 * API request/response types
 */

export interface RecipientInput {
  email: string;
}

export interface SecretRecipient {
  id: string;
  email: string;
  normalizedEmail: string;
  createdAt: number;
  updatedAt: number;
}

export interface AttachmentCipherDescriptor {
  fileId: string;
  originalName?: string;
  mimeType?: string;
  size: number;
  chunkCount?: number;
  chunkSize?: number;
  fileNonceBase64?: string;
}

export interface SecretEncryptionEnvelope {
  version: 1;
  keySource: 'fragment';
  algorithm: 'AES-GCM';
  contentIv?: string;
  chunkSize?: number;
  ivStrategy?: 'per-chunk';
  contentEncoding?: 'utf-8' | 'base64';
  attachments?: AttachmentCipherDescriptor[];
}

export interface SecretAccessRequirements {
  recipientAuthRequired: boolean;
  encrypted: boolean;
}

export interface SecretAccessConfig {
  recipients: SecretRecipient[];
  encryption: SecretEncryptionEnvelope | null;
}

export interface UpdateSecretAccessBody {
  recipients: RecipientInput[];
  encryption?: SecretEncryptionEnvelope | null;
}

export interface SendRecipientOtpBody {
  email: string;
}

export interface VerifyRecipientOtpBody {
  email: string;
  otp: string;
}

export interface RecipientOtpResponse {
  ok?: boolean;
  expiresInSeconds?: number;
  retryAfterSeconds?: number;
  error?: string;
  code?: number;
}

export interface StartMultipartUploadBody {
  fileName: string;
  size: number;
  mimeType?: string;
  euJurisdiction?: boolean;
}

export interface StartMultipartUploadResponse {
  fileId: string;
  objectKey: string;
  uploadId: string;
  expiresAt: number;
  recommendedChunkSize?: number;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    endpoint: string;
    bucket: string;
  };
}

export interface CompleteMultipartUploadBody {
  fileId: string;
  uploadId: string;
  objectKey: string;
  parts: Array<{
    partNumber: number;
    etag: string;
  }>;
}

export interface GetMultipartUploadPartUrlBody {
  fileId: string;
  uploadId: string;
  objectKey: string;
  partNumber: number;
  contentType?: string;
}

export interface GetMultipartUploadPartUrlResponse {
  url: string;
  expiresAt: number;
}

export interface CancelMultipartUploadBody {
  fileId: string;
  uploadId: string;
  objectKey: string;
}

export interface CreateSecretBody {
  content: string;
  expire?: number;
  euJurisdiction?: boolean;
  attachments?: SecretAttachment[];
  recipients: RecipientInput[];
  encryption?: SecretEncryptionEnvelope | null;
}

export interface UpdateSecretBody {
  content: string;
  expire?: number;
  attachments?: SecretAttachment[];
  encryption?: SecretEncryptionEnvelope | null;
}

export interface SecretAttachment {
  id: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface UploadFileParams {
  file: File;
  euJurisdiction?: boolean;
}

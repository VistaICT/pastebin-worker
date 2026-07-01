// Types
export type {
  SecretResponse,
  UploadFileResponse,
  AttachmentTransferStage,
  AttachmentTransferProgress,
  AttachmentTransferOptions,
} from './types';
export type { SecretAttachment } from '@lockbox/types/api';

// Auth
export { getMe, logout } from './auth';

// Secrets
export type { CreateSecretBody } from './secrets';
export {
  createSecret,
  getSecret,
  sendRecipientOtp,
  verifyRecipientOtp,
  updateSecret,
  getSecretAccess,
  updateSecretAccess,
  deleteSecret,
} from './secrets';

// File Upload
export type { UploadFileParams } from './files-upload';
export {
  uploadFile,
} from './files-upload';

// File Download
export {
  downloadAttachment,
} from './files-download';

/**
 * Domain types for secrets (pastes/files)
 */

export interface Secret {
  id: string;
  content: string;
  expire: number;
  createdAt: number;
  createdBy?: string;
  euJurisdiction: boolean;
  metadata?: Record<string, unknown>;
}

export interface File {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
  createdBy?: string;
  expire: number;
  bucketLocation: 'global' | 'eu';
}

export interface SecretMetadata {
  isPrivate?: boolean;
  attachmentIds?: string[];
}

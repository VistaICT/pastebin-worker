import { toast } from 'react-hot-toast';
import type { SecretEncryptionEnvelope } from '@lockbox/types/api';

import { hasInvalidRecipient, normalizeRecipients } from '@/components/secret-create/recipient-utils';
import type { RecipientEntry } from '@/components/secret-create/types';
import { encryptSecretText, readFragmentKey } from '@/lib/secret-crypto';
import { deleteSecret, updateSecret, updateSecretAccess, type SecretAttachment } from '@/service';

interface SaveSecretParams {
  secretId: string;
  canEdit: boolean;
  isSaving: boolean;
  canSaveSecret: boolean;
  content: string;
  attachmentList: SecretAttachment[];
  recipientEntries: RecipientEntry[];
  clientEncryptionEnabled: boolean;
  fragmentKey: string | null;
  encryptionEnvelope: SecretEncryptionEnvelope | null;
  expiryEnabled: boolean;
  expiration: number;
  setRecipientEntries: (value: RecipientEntry[] | ((prev: RecipientEntry[]) => RecipientEntry[])) => void;
  setIsSaving: (value: boolean) => void;
  setFragmentKey: (value: string | null) => void;
  setEncryptionEnvelope: (value: SecretEncryptionEnvelope | null) => void;
  onSaved: () => void;
}

export async function saveSecret(params: SaveSecretParams) {
  const {
    secretId,
    canEdit,
    isSaving,
    canSaveSecret,
    content,
    attachmentList,
    recipientEntries,
    clientEncryptionEnabled,
    fragmentKey,
    encryptionEnvelope,
    expiryEnabled,
    expiration,
    setRecipientEntries,
    setIsSaving,
    setFragmentKey,
    setEncryptionEnvelope,
    onSaved,
  } = params;

  if (!secretId || !canEdit || isSaving) return;
  if (!canSaveSecret) {
    toast.error('Add text, an attachment, or both');
    return;
  }

  setRecipientEntries((prev) => prev.map((entry) => ({ ...entry, touched: true })));
  const normalizedRecipients = normalizeRecipients(recipientEntries.map((entry) => entry.email));
  if (normalizedRecipients.length === 0) {
    toast.error('Add at least one recipient email');
    return;
  }
  if (hasInvalidRecipient(recipientEntries)) {
    toast.error('Fix invalid recipient email addresses');
    return;
  }

  setIsSaving(true);
  try {
    let contentToPersist = content;
    let nextEncryption: SecretEncryptionEnvelope | null | undefined = undefined;

    if (clientEncryptionEnabled) {
      const key = fragmentKey ?? readFragmentKey();
      if (!key) {
        toast.error('Missing encryption key. Use the full link with #k= to save encrypted changes.');
        return;
      }

      setFragmentKey(key);
      const encryptedContent = content.length > 0
        ? await encryptSecretText(content, key)
        : null;

      contentToPersist = encryptedContent?.ciphertext ?? '';
      nextEncryption = {
        ...(encryptionEnvelope ?? {
          version: 1,
          keySource: 'fragment',
          algorithm: 'AES-GCM',
          contentEncoding: 'base64',
        }),
        contentIv: encryptedContent?.ivBase64,
      };
    }

    const [secretUpdate, accessUpdate] = await Promise.all([
      updateSecret({
        id: secretId,
        content: contentToPersist,
        expire: expiryEnabled ? expiration : 0,
        attachments: attachmentList,
        encryption: nextEncryption,
      }),
      updateSecretAccess(secretId, {
        recipients: normalizedRecipients.map((email) => ({ email })),
      }),
    ]);

    if (secretUpdate.error) {
      toast.error(secretUpdate.error);
      return;
    }
    if (accessUpdate.error) {
      toast.error(accessUpdate.error);
      return;
    }

    setRecipientEntries((accessUpdate.recipients ?? []).map((recipient) => ({
      id: crypto.randomUUID(),
      email: recipient.email,
      touched: false,
    })));
    setEncryptionEnvelope(nextEncryption ?? null);
    toast.success('Saved');
    onSaved();
  } finally {
    setIsSaving(false);
  }
}

interface DeleteSecretParams {
  secretId: string;
  canEdit: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  setIsDeleting: (value: boolean) => void;
  onDeleted: () => void;
}

export async function deleteSecretWithPrompt(params: DeleteSecretParams) {
  const { secretId, canEdit, isDeleting, isSaving, setIsDeleting, onDeleted } = params;
  if (!secretId || !canEdit || isDeleting || isSaving) return;

  const confirmed = window.confirm('Delete this secret permanently? This action cannot be undone.');
  if (!confirmed) return;

  setIsDeleting(true);
  const data = await deleteSecret(secretId);
  setIsDeleting(false);

  if (data.error) {
    toast.error(data.error);
    return;
  }

  toast.success('Secret deleted');
  onDeleted();
}

interface CopyLinkParams {
  shareLink: string;
  setLinkCopied: (value: boolean) => void;
}

export async function copyShareLink(params: CopyLinkParams) {
  const { shareLink, setLinkCopied } = params;
  try {
    await navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
  } catch {
    toast.error('Clipboard access failed');
  }
}

import { toast } from 'react-hot-toast';
import type { SecretEncryptionEnvelope } from '@lockbox/types/api';

import type { AttachmentDraft, RecipientEntry } from '@/components/secret-create/types';
import { decryptSecretText, readFragmentKey } from '@/lib/secret-crypto';
import { getSecret, getSecretAccess } from '@/service';
import { hasEditSessionToken } from '@/utils/edit-session';
import { buildAttachmentDrafts } from '../utils';

interface LoadSecretStateParams {
  secretId: string;
  user: { id: string; email: string; name: string | null } | null;
  setCanEdit: (value: boolean) => void;
  setIsLoading: (value: boolean) => void;
  setIsAuth: (value: boolean) => void;
  setAccessHint: (value: string) => void;
  setEuJurisdiction: (value: boolean) => void;
  setAttachments: (value: AttachmentDraft[]) => void;
  setEncryptionEnvelope: (value: SecretEncryptionEnvelope | null) => void;
  setClientEncryptionEnabled: (value: boolean) => void;
  setExpiration: (value: number) => void;
  setExpiryEnabled: (value: boolean) => void;
  setFragmentKey: (value: string | null) => void;
  setMissingKey: (value: boolean) => void;
  setContent: (value: string) => void;
}

export async function loadSecretState(params: LoadSecretStateParams) {
  const {
    secretId,
    user,
    setCanEdit,
    setIsLoading,
    setIsAuth,
    setAccessHint,
    setEuJurisdiction,
    setAttachments,
    setEncryptionEnvelope,
    setClientEncryptionEnabled,
    setExpiration,
    setExpiryEnabled,
    setFragmentKey,
    setMissingKey,
    setContent,
  } = params;

  if (!secretId) return;

  setCanEdit(hasEditSessionToken(secretId));
  setIsLoading(true);

  const data = await getSecret(secretId);
  if (data.error) {
    if (data.code === 403) {
      const access = data.access;
      if (access?.recipientAuthRequired) {
        setAccessHint(user ? 'Verify with a recipient email to open this secret.' : 'Enter a recipient email to receive a verification code.');
        setIsAuth(false);
      } else {
        toast.error(data.error);
      }
      setIsLoading(false);
      return;
    }

    toast.error(data.error);
    setIsLoading(false);
    return;
  }

  setIsAuth(true);
  setAccessHint('');
  setEuJurisdiction(Boolean(data.euJurisdiction));
  setAttachments(buildAttachmentDrafts(data.attachments));
  setEncryptionEnvelope(data.encryption ?? null);
  setClientEncryptionEnabled(Boolean(data.encryption));

  const expireValue = typeof data.expire === 'number' && data.expire > 0 ? data.expire : 0;
  setExpiration(expireValue);
  setExpiryEnabled(expireValue > 0);

  if (data.encryption?.algorithm === 'AES-GCM' && data.encryption.contentIv) {
    const key = readFragmentKey();
    if (!key) {
      setFragmentKey(null);
      setMissingKey(true);
      setContent('');
      setIsLoading(false);
      return;
    }

    try {
      const decrypted = await decryptSecretText(data.content ?? '', data.encryption.contentIv, key);
      setFragmentKey(key);
      setMissingKey(false);
      setContent(decrypted);
    } catch {
      toast.error('Could not decrypt this secret with the current link key');
      setFragmentKey(null);
      setMissingKey(true);
      setContent('');
    }
  } else {
    setFragmentKey(null);
    setMissingKey(false);
    setContent(data.content ?? '');
  }

  setIsLoading(false);
}

interface LoadRecipientsForEditParams {
  secretId: string;
  canEdit: boolean;
  setRecipientEntries: (value: RecipientEntry[] | ((prev: RecipientEntry[]) => RecipientEntry[])) => void;
}

export async function loadRecipientsForEdit(params: LoadRecipientsForEditParams) {
  const { secretId, canEdit, setRecipientEntries } = params;
  if (!secretId || !canEdit) return;

  const data = await getSecretAccess(secretId);
  if (data.error) return;

  const recipients = data.recipients ?? [];
  if (recipients.length === 0) {
    setRecipientEntries([{ id: crypto.randomUUID(), email: '', touched: false }]);
    return;
  }

  setRecipientEntries(
    recipients.map((recipient) => ({
      id: crypto.randomUUID(),
      email: recipient.email,
      touched: false,
    })),
  );
}

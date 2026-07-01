import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AttachmentDraft, RecipientEntry, UploadQueueItem } from '@/components/secret-create/types';
import { createRecipientEntry } from '@/components/secret-editor/recipient-entry-state';
import type { SecretEncryptionEnvelope } from '@lockbox/types/api';
import type { SecretAttachment } from '@/service';
import { loadRecipientsForEdit, loadSecretState } from './secret-detail-load-ops';
import { sendOtp, verifyOtp } from './secret-detail-otp-ops';
import { openAttachment, uploadAttachments } from './secret-detail-attachment-ops';
import { copyShareLink, deleteSecretWithPrompt, saveSecret } from './secret-detail-actions-ops';
import { useAuth } from '@/context/auth';

interface UseSecretDetailStateParams {
  secretId: string;
  onDeleted: () => void;
}

export function useSecretDetailState({ secretId, onDeleted }: UseSecretDetailStateParams) {
  const { user } = useAuth();

  const [content, setContent] = useState('');
  const [isAuth, setIsAuth] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerifyLoading, setOtpVerifyLoading] = useState(false);
  const [otpRetryAfter, setOtpRetryAfter] = useState(0);
  const [accessHint, setAccessHint] = useState('');
  const [detailContext, setDetailContext] = useState<'view' | 'edit'>('view');
  const [origin, setOrigin] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [euJurisdiction, setEuJurisdiction] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [recipientEntries, setRecipientEntries] = useState<RecipientEntry[]>([
    createRecipientEntry(),
  ]);
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [expiration, setExpiration] = useState(0);
  const [clientEncryptionEnabled, setClientEncryptionEnabled] = useState(false);
  const [encryptionEnvelope, setEncryptionEnvelope] = useState<SecretEncryptionEnvelope | null>(null);
  const [fragmentKey, setFragmentKey] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [missingKey, setMissingKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const attachmentList = useMemo(() => attachments.map((item) => item.attachment), [attachments]);
  const canSaveSecret = content.trim().length > 0 || attachmentList.length > 0;
  const shareUrl = `${origin}/${secretId}`;
  const shareLink = `${shareUrl}${window.location.hash || ''}`;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const reloadSecret = useCallback(async () => {
    await loadSecretState({
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
    });
  }, [secretId, user]);

  useEffect(() => {
    void reloadSecret();
  }, [reloadSecret]);

  useEffect(() => {
    void loadRecipientsForEdit({ secretId, canEdit, setRecipientEntries });
  }, [canEdit, secretId]);

  useEffect(() => {
    if (otpRetryAfter <= 0) return;
    const timer = window.setInterval(() => {
      setOtpRetryAfter((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpRetryAfter]);

  useEffect(() => {
    if (!linkCopied) return;
    const timeoutId = window.setTimeout(() => setLinkCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [linkCopied]);

  const handleSendOtp = useCallback(async () => {
    await sendOtp({
      secretId,
      recipientEmail,
      otpRetryAfter,
      setOtpLoading,
      setOtpRetryAfter,
      setOtpRequested,
    });
  }, [otpRetryAfter, recipientEmail, secretId]);

  const handleVerifyOtp = useCallback(async () => {
    await verifyOtp({
      secretId,
      recipientEmail,
      otpCode,
      setOtpVerifyLoading,
      setOtpCode,
      reloadSecret,
    });
  }, [otpCode, recipientEmail, reloadSecret, secretId]);

  const handleCopyLink = useCallback(async () => {
    await copyShareLink({ shareLink, setLinkCopied });
  }, [shareLink]);

  const handleSave = useCallback(async () => {
    await saveSecret({
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
      onSaved: () => setDetailContext('view'),
    });
  }, [
    attachmentList,
    attachments,
    canEdit,
    canSaveSecret,
    clientEncryptionEnabled,
    content,
    encryptionEnvelope,
    expiration,
    expiryEnabled,
    fragmentKey,
    isSaving,
    recipientEntries,
    secretId,
  ]);

  const handleDelete = useCallback(async () => {
    await deleteSecretWithPrompt({
      secretId,
      canEdit,
      isDeleting,
      isSaving,
      setIsDeleting,
      onDeleted,
    });
  }, [canEdit, isDeleting, isSaving, onDeleted, secretId]);

  const handleOpenAttachment = useCallback(async (file: SecretAttachment) => {
    await openAttachment({
      file,
    });
  }, []);

  const handleUploadAttachments = useCallback(async (files: File[]) => {
    await uploadAttachments({
      files,
      euJurisdiction,
      setUploadingAttachment,
      setUploadAbortController,
      setUploadQueue,
      setAttachments,
    });
  }, [euJurisdiction]);

  return {
    status: {
      isLoading,
      isAuth,
      accessHint,
      canEdit,
      missingKey,
      linkCopied,
      euJurisdiction,
    },
    otp: {
      recipientEmail,
      setRecipientEmail,
      otpCode,
      setOtpCode,
      otpRequested,
      otpLoading,
      otpVerifyLoading,
      otpRetryAfter,
      send: handleSendOtp,
      verify: handleVerifyOtp,
    },
    editor: {
      content,
      setContent,
      detailContext,
      setDetailContext,
      canSaveSecret,
      isSaving,
      isDeleting,
      save: handleSave,
      delete: handleDelete,
      copyLink: handleCopyLink,
    },
    recipients: {
      entries: recipientEntries,
      setEntries: setRecipientEntries,
    },
    attachments: {
      drafts: attachments,
      setDrafts: setAttachments,
      list: attachmentList,
      dragOver,
      setDragOver,
      uploading: uploadingAttachment,
      queue: uploadQueue,
      uploadAbortController,
      upload: handleUploadAttachments,
      open: handleOpenAttachment,
    },
    settings: {
      expiryEnabled,
      setExpiryEnabled,
      expiration,
      setExpiration,
      clientEncryptionEnabled,
      euJurisdiction,
    },
  };
}

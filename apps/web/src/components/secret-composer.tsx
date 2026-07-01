import { ChangeEvent, useState } from 'react';
import { toast } from 'react-hot-toast';

import SecretEditorPanel, { type SecretEditorPanelProps } from '@/components/secret-editor/secret-editor-panel';
import {
  addRecipientEntry,
  createRecipientEntry,
  markRecipientEntryTouched,
  removeRecipientEntryAt,
  setRecipientEntryAt,
} from '@/components/secret-editor/recipient-entry-state';
import type { AttachmentDraft, RecipientEntry, UploadQueueItem } from '@/components/secret-create/types';
import { hasInvalidRecipient, normalizeRecipients } from '@/components/secret-create/recipient-utils';
import { buildFragmentHash, createFragmentKey, encryptSecretText } from '@/lib/secret-crypto';
import {
  createSecret,
  uploadFile,
} from '@/service';
import { setEditSessionToken } from '@/utils/edit-session';
import { ShareStorage } from '@/utils/share-storage';

export default function SecretComposer() {
  const language = 'markdown';
  const [content, setContent] = useState('');
  const [recipientEntries, setRecipientEntries] = useState<RecipientEntry[]>([
    createRecipientEntry(),
  ]);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [editorPreviewMode, setEditorPreviewMode] = useState<'edit' | 'preview'>('edit');
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [expiration, setExpiration] = useState(0);
  const [clientEncryptionEnabled, setClientEncryptionEnabled] = useState(true);
  const [euJurisdiction, setEuJurisdiction] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [fragmentKey, setFragmentKey] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);

  const canCreateSecret = content.trim().length > 0 || attachments.length > 0;

  const uploadAttachments = async (files: File[]) => {
    if (files.length === 0) return;

    const queued = files.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      size: file.size,
      status: 'pending' as const,
      progress: {
        fileName: file.name,
        stage: 'preparing' as const,
        overallProgress: 0,
        completedBytes: 0,
        totalBytes: file.size,
        chunkIndex: 0,
        chunkCount: 1,
      },
    }));
    setUploadQueue(queued);

    const abortController = new AbortController();
    setUploadingAttachment(true);
    setUploadAbortController(abortController);
    const toastId = toast.loading(files.length === 1 ? 'Uploading attachment…' : `Uploading ${files.length} attachments…`);

    try {
      const uploaded: AttachmentDraft[] = [];
      let failed = 0;
      let cancelled = false;

      for (const [index, file] of files.entries()) {
        const queueId = queued[index]?.id;
        if (!queueId) continue;

        setUploadQueue((prev) => prev.map((item) => (
          item.id === queueId
            ? {
              ...item,
              status: 'processing',
            }
            : item
        )));

        const data = await uploadFile({ file, euJurisdiction, signal: abortController.signal });

        setUploadQueue((prev) => prev.map((item) => (
          item.id === queueId
            ? {
              ...item,
              status: 'processing',
              progress: {
                ...item.progress,
                stage: 'uploading',
                overallProgress: 90,
                completedBytes: file.size,
                totalBytes: file.size,
              },
            }
            : item
        )));

        if ('error' in data && data.error) {
          if (data.error === 'Attachment upload cancelled') {
            cancelled = true;
            setUploadQueue((prev) => prev.map((item) => (
              item.id === queueId
                ? {
                  ...item,
                  status: 'cancelled',
                }
                : item
            )));
            break;
          }

          failed += 1;
          setUploadQueue((prev) => prev.map((item) => (
            item.id === queueId
              ? {
                ...item,
                status: 'error',
                error: data.error,
              }
              : item
          )));
          continue;
        }

        if (!('id' in data) || !('url' in data) || !data.id || !data.url) {
          failed += 1;
          setUploadQueue((prev) => prev.map((item) => (
            item.id === queueId
              ? {
                ...item,
                status: 'error',
                error: `Failed to upload ${file.name}`,
              }
              : item
          )));
          continue;
        }

        uploaded.push({
          attachment: {
            id: data.id,
            url: data.url,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
          },
        });

        setUploadQueue((prev) => prev.map((item) => (
          item.id === queueId
            ? {
              ...item,
              status: 'success',
              progress: {
                ...item.progress,
                overallProgress: 100,
                completedBytes: item.size,
                totalBytes: item.size,
                stage: 'complete',
              },
            }
            : item
        )));
      }

      if (cancelled) {
        setUploadQueue((prev) => prev.map((item) => (
          item.status === 'pending'
            ? { ...item, status: 'cancelled' }
            : item
        )));
      }

      setAttachments((prev) => {
        const existing = new Set(prev.map((a) => a.attachment.id));
        return [...prev, ...uploaded.filter((a) => !existing.has(a.attachment.id))];
      });

      if (cancelled) {
        toast('Attachment upload cancelled');
      } else if (failed > 0) {
        toast.error(`Uploaded ${uploaded.length} of ${files.length} attachments`);
      } else {
        toast.success(files.length === 1 ? 'Attachment uploaded' : 'Attachments uploaded');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Attachment upload failed';
      if (message === 'Attachment upload cancelled') {
        toast('Attachment upload cancelled');
      } else {
        toast.error(message);
      }
    } finally {
      toast.dismiss(toastId);
      setUploadingAttachment(false);
      setUploadAbortController(null);
    }
  };

  const handleCancelAttachmentUpload = () => {
    uploadAbortController?.abort();
  };

  const handleCreate = async () => {
    if (!canCreateSecret) return toast.error('Add text, an attachment, or both');

    setRecipientEntries((prev) => prev.map((entry) => ({ ...entry, touched: true })));

    const normalizedRecipients = normalizeRecipients(recipientEntries.map((entry) => entry.email));
    if (normalizedRecipients.length === 0) {
      return toast.error('Add at least one recipient email');
    }

    const invalidRecipientFound = hasInvalidRecipient(recipientEntries);
    if (invalidRecipientFound) {
      return toast.error('Fix invalid recipient email addresses');
    }

    setPublishing(true);
    try {
      const activeKey = clientEncryptionEnabled
        ? (fragmentKey ?? await createFragmentKey())
        : null;
      const encryptedContent = clientEncryptionEnabled && activeKey && content.length > 0
        ? await encryptSecretText(content, activeKey)
        : null;

      const encryptionEnvelope = clientEncryptionEnabled
        ? {
          version: 1 as const,
          keySource: 'fragment' as const,
          algorithm: 'AES-GCM' as const,
          contentEncoding: 'base64' as const,
          contentIv: encryptedContent?.ivBase64,
        }
        : null;

      const data = await createSecret({
        content: encryptedContent?.ciphertext ?? content,
        expire: expiryEnabled ? expiration : 0,
        euJurisdiction,
        attachments: attachments.map((item) => item.attachment),
        recipients: normalizedRecipients.map((email) => ({ email })),
        encryption: encryptionEnvelope,
      });

      if (data.error) {
        toast.error(data.error);
        setPublishing(false);
        return;
      }

      const hash = clientEncryptionEnabled && activeKey ? buildFragmentHash(activeKey) : '';
      const secretHref = `/${data.id!}${hash}`;

      ShareStorage.save({
        title: content.split('\n')[0]?.slice(0, 50)
          || attachments[0]?.attachment.name
          || `${language} secret`,
        content: secretHref,
        type: 'text',
        language,
      });

      if (data.id && data.editToken) {
        setEditSessionToken(data.id, data.editToken);
      }

      window.location.assign(secretHref);
    } catch {
      toast.error('Failed to create secret');
    } finally {
      setPublishing(false);
    }
  };

  const handleExpiryToggle = (checked: boolean) => {
    setExpiryEnabled(checked);
    if (checked && expiration === 0) {
      setExpiration(86400);
    }
  };

  const handleEncryptionToggle = (checked: boolean) => {
    if (!checked) {
      setFragmentKey(null);
    }

    setClientEncryptionEnabled(checked);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.attachment.id !== id));
  };

  const addRecipient = () => {
    setRecipientEntries((prev) => addRecipientEntry(prev));
  };

  const removeRecipientAt = (index: number) => {
    setRecipientEntries((prev) => removeRecipientEntryAt(prev, index));
  };

  const setRecipientAt = (index: number, value: string) => {
    setRecipientEntries((prev) => setRecipientEntryAt(prev, index, value));
  };

  const markRecipientTouched = (index: number) => {
    setRecipientEntries((prev) => markRecipientEntryTouched(prev, index));
  };

  const onFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    await uploadAttachments(files);
  };

  const onAttachmentDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);

    const items = Array.from(e.dataTransfer.items ?? []);
    if (items.length > 0 && !items.some((item) => item.kind === 'file')) {
      toast.error('Only file drops are supported');
      return;
    }

    const files = Array.from(e.dataTransfer.files ?? []);
    await uploadAttachments(files);
  };

  const createPanelProps: SecretEditorPanelProps = {
    editor: {
      content,
      onContentChange: setContent,
      previewMode: editorPreviewMode,
      onTogglePreviewMode: () => setEditorPreviewMode((m) => (m === 'edit' ? 'preview' : 'edit')),
    },
    attachments: {
      items: attachments,
      onRemove: removeAttachment,
      uploading: uploadingAttachment,
      queue: uploadQueue,
      onCancelUpload: handleCancelAttachmentUpload,
      onDrop: onAttachmentDrop,
      onFileInputChange: onFileInputChange,
      dragOver,
      onDragOver: (e) => {
        e.preventDefault();
        setDragOver(true);
      },
      onDragLeave: () => setDragOver(false),
    },
    recipients: {
      entries: recipientEntries,
      onAdd: addRecipient,
      onRemoveAt: removeRecipientAt,
      onSetAt: setRecipientAt,
      onMarkTouched: markRecipientTouched,
    },
    settings: {
      expiryEnabled,
      expiration,
      onExpiryToggle: handleExpiryToggle,
      onExpirationChange: setExpiration,
      clientEncryptionEnabled,
      onEncryptionToggle: handleEncryptionToggle,
      euJurisdiction,
      onEuJurisdictionToggle: setEuJurisdiction,
    },
    submit: {
      label: publishing ? 'Creating…' : 'Create secret',
      disabled: publishing || uploadingAttachment || !canCreateSecret,
      onSubmit: () => {
        void handleCreate();
      },
    },
  };

  return <SecretEditorPanel {...createPanelProps} />;
}

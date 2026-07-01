import { toast } from 'react-hot-toast';

import type { AttachmentDraft, UploadQueueItem } from '@/components/secret-create/types';
import { downloadAttachment, uploadFile, type SecretAttachment } from '@/service';

interface UploadAttachmentsParams {
  files: File[];
  euJurisdiction: boolean;
  setUploadingAttachment: (value: boolean) => void;
  setUploadAbortController: (value: AbortController | null) => void;
  setUploadQueue: (value: UploadQueueItem[] | ((prev: UploadQueueItem[]) => UploadQueueItem[])) => void;
  setAttachments: (value: AttachmentDraft[] | ((prev: AttachmentDraft[]) => AttachmentDraft[])) => void;
}

export async function uploadAttachments(params: UploadAttachmentsParams) {
  const {
    files,
    euJurisdiction,
    setUploadingAttachment,
    setUploadAbortController,
    setUploadQueue,
    setAttachments,
  } = params;

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
  const toastId = toast.loading(files.length === 1 ? 'Uploading attachment...' : `Uploading ${files.length} attachments...`);

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

      const data = await uploadFile({ file, euJurisdiction, signal: abortController.signal });

      if (data.error) {
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

      if (!data.id || !data.url) {
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
      const existing = new Set(prev.map((item) => item.attachment.id));
      return [...prev, ...uploaded.filter((item) => !existing.has(item.attachment.id))];
    });

    if (cancelled) {
      toast('Attachment upload cancelled');
    } else if (failed > 0) {
      toast.error(`Uploaded ${uploaded.length} of ${files.length} attachments`);
    } else {
      toast.success(files.length === 1 ? 'Attachment uploaded' : 'Attachments uploaded');
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Attachment upload failed');
  } finally {
    toast.dismiss(toastId);
    setUploadingAttachment(false);
    setUploadAbortController(null);
  }
}

interface OpenAttachmentParams {
  file: SecretAttachment;
}

export async function openAttachment(params: OpenAttachmentParams) {
  const { file } = params;

  try {
    await downloadAttachment(file);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to download attachment');
  }
}

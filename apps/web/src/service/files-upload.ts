import type { UploadFileParams } from '@lockbox/types/api';
import { cancelUpload, finalizeUpload, startUpload, uploadPart, type UploadSession } from './files-upload-helpers';
import { isAbortError } from './utils';
import type { UploadFileResponse } from './types';

export type { UploadFileParams } from '@lockbox/types/api';

export async function uploadFile({ file, euJurisdiction = false, signal }: UploadFileParams & { signal?: AbortSignal }) {
  const started = await startUpload({
    fileName: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    euJurisdiction,
  });

  if (started.error) {
    return started as UploadFileResponse;
  }

  const session = started as UploadSession;
  const totalParts = Math.ceil(file.size / session.chunkSize);
  const uploadedParts: Array<{ partNumber: number; etag: string }> = [];

  try {
    for (let index = 0; index < totalParts; index++) {
      if (signal?.aborted) {
        throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      }

      const partNumber = index + 1;
      const chunk = file.slice(index * session.chunkSize, Math.min(file.size, (index + 1) * session.chunkSize));
      const etag = await uploadPart(session, partNumber, chunk, file.type || 'application/octet-stream', signal);
      uploadedParts.push({ partNumber, etag });
    }

    return finalizeUpload(session, uploadedParts, signal);
  } catch (error) {
    if (isAbortError(error)) {
      return {
        error: 'Attachment upload cancelled',
      };
    }

    await cancelUpload(session);
    return {
      error: error instanceof Error ? error.message : 'Direct upload failed',
    };
  }
}


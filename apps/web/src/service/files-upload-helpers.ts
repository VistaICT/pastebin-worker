import type { StartMultipartUploadBody, CancelMultipartUploadBody, CompleteMultipartUploadBody } from '@lockbox/types/api';
import { api, parseApiResponse } from './utils';
import { getMultipartUploadPartUrl } from './files-api';

export interface UploadSession {
  fileId: string;
  uploadId: string;
  objectKey: string;
  chunkSize: number;
}

export async function startUpload(payload: StartMultipartUploadBody) {
  const res = await fetch(api('/api/files/upload-start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await parseApiResponse<any>(res);
  if (data.error) return { error: data.error, raw: data.raw };

  if (!data.fileId || !data.uploadId || !data.objectKey) {
    throw new Error('Missing required upload fields from server');
  }

  return {
    fileId: data.fileId,
    uploadId: data.uploadId,
    objectKey: data.objectKey,
    chunkSize: data.recommendedChunkSize ?? 8 * 1024 * 1024,
  };
}

export async function uploadPart(session: UploadSession, partNumber: number, chunk: Blob | ArrayBuffer, contentType: string, signal?: AbortSignal) {
  const urlResult = await getMultipartUploadPartUrl({
    fileId: session.fileId,
    uploadId: session.uploadId,
    objectKey: session.objectKey,
    partNumber,
    contentType,
  });

  if (urlResult.error || !urlResult.url) {
    throw new Error(urlResult.error || 'Failed to get presigned upload URL');
  }

  const response = await fetch(urlResult.url, {
    method: 'PUT',
    body: chunk,
    signal,
    headers: { 'Content-Type': contentType },
  });

  if (!response.ok) {
    const errorText = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`Upload part ${partNumber} failed (${response.status})${errorText ? `: ${errorText}` : ''}`);
  }

  const etag = response.headers.get('etag')?.replaceAll('"', '');
  if (!etag) throw new Error(`Upload part ${partNumber} missing ETag`);

  return etag;
}

export async function finalizeUpload(session: UploadSession, parts: Array<{ partNumber: number; etag: string }>, signal?: AbortSignal) {
  const payload: CompleteMultipartUploadBody = {
    fileId: session.fileId,
    uploadId: session.uploadId,
    objectKey: session.objectKey,
    parts,
  };

  const res = await fetch(api('/api/files/upload-complete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify(payload),
  });

  return parseApiResponse<any>(res);
}

export async function cancelUpload(session: UploadSession) {
  const payload: CancelMultipartUploadBody = {
    fileId: session.fileId,
    uploadId: session.uploadId,
    objectKey: session.objectKey,
  };

  await fetch(api('/api/files/upload-cancel'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }).catch(() => {});
}

import type { AttachmentTransferProgress, AttachmentTransferOptions } from './types';

const api = (path: string) => path; // same-origin

export { api };

export async function parseApiResponse<T extends object>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (isJson) {
    const data = await res.json() as T;
    if (!res.ok && !('error' in data)) {
      return { ...data, error: `Request failed (${res.status})` } as T;
    }
    return data;
  }

  const text = await res.text();
  const authError = res.status === 401 || res.status === 403;
  const hint = authError ? 'Please sign in again.' : 'Unexpected response from server.';

  return {
    error: `Request failed (${res.status}). ${hint}`,
    raw: text.slice(0, 300),
  } as unknown as T;
}

export function reportProgress(onProgress: AttachmentTransferOptions['onProgress'], progress: AttachmentTransferProgress) {
  onProgress?.({
    ...progress,
    overallProgress: Math.max(0, Math.min(100, progress.overallProgress)),
  });
}

export function calculateOverallProgress(totalBytes: number, encryptedBytes: number, uploadedBytes: number) {
  if (totalBytes <= 0) return 0;
  const weighted = (encryptedBytes + uploadedBytes) / (totalBytes * 2);
  return weighted * 95;
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Transfer cancelled', 'AbortError');
  }
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

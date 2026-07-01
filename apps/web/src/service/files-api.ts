import type {
  GetMultipartUploadPartUrlBody,
  GetMultipartUploadPartUrlResponse,
} from '@lockbox/types/api';
import { api, parseApiResponse } from './utils';

export async function getMultipartUploadPartUrl(body: GetMultipartUploadPartUrlBody) {
  const res = await fetch(api('/api/files/upload-part-url'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return parseApiResponse<GetMultipartUploadPartUrlResponse & { error?: string; raw?: string }>(res);
}

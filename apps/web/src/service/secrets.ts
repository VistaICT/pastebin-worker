import type {
  CreateSecretBody,
  UpdateSecretBody,
  RecipientOtpResponse,
  SecretAccessConfig,
} from '@lockbox/types/api';
import { api, parseApiResponse } from './utils';
import type { SecretResponse } from './types';

export type { CreateSecretBody } from '@lockbox/types/api';

export async function createSecret(body: CreateSecretBody) {
  const res = await fetch(api('/api/secrets'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return parseApiResponse<{
    id?: string;
    editToken?: string;
    url?: string;
    attachments?: any[];
    error?: string;
    raw?: string;
  }>(res);
}

export async function getSecret(id: string) {
  const res = await fetch(api(`/api/secrets/${id}`), {
    credentials: 'include',
  });
  return parseApiResponse<SecretResponse>(res);
}

export async function sendRecipientOtp(secretId: string, email: string) {
  const res = await fetch(api(`/api/secrets/${secretId}/otp/send`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  return parseApiResponse<RecipientOtpResponse>(res);
}

export async function verifyRecipientOtp(secretId: string, email: string, otp: string) {
  const res = await fetch(api(`/api/secrets/${secretId}/otp/verify`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, otp }),
  });
  return parseApiResponse<RecipientOtpResponse>(res);
}

export async function updateSecret(params: { id: string } & UpdateSecretBody) {
  const res = await fetch(api(`/api/secrets/${params.id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      content: params.content,
      expire: params.expire,
      attachments: params.attachments,
      encryption: params.encryption,
    }),
  });
  return parseApiResponse<{ id?: string; url?: string; error?: string; raw?: string }>(res);
}

export async function getSecretAccess(id: string) {
  const res = await fetch(api(`/api/secrets/${id}/access`), {
    credentials: 'include',
  });
  return parseApiResponse<({ secretId?: string; error?: string; raw?: string } & SecretAccessConfig)>(res);
}

export async function updateSecretAccess(id: string, body: {
  recipients: Array<{ email: string }>;
  encryption?: any;
}) {
  const res = await fetch(api(`/api/secrets/${id}/access`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return parseApiResponse<({ secretId?: string; error?: string; raw?: string } & SecretAccessConfig)>(res);
}

export async function deleteSecret(id: string) {
  const res = await fetch(api(`/api/secrets/${id}`), {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseApiResponse<{ id?: string; deleted?: boolean; error?: string; raw?: string }>(res);
}

import { api, parseApiResponse } from './utils';

export async function getMe() {
  const res = await fetch(api('/auth/me'), { credentials: 'include' });
  if (!res.ok) return null;
  return res.json() as Promise<{ id: string; email: string; name: string | null }>;
}

export async function logout() {
  await fetch(api('/auth/logout'), { method: 'POST', credentials: 'include' });
}

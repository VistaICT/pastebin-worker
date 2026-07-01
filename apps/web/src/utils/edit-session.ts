const EDIT_COOKIE_PREFIX = 'lb_edit_';

export function getEditSessionCookieName(secretId: string): string {
  return `${EDIT_COOKIE_PREFIX}${secretId}`;
}

export function setEditSessionToken(secretId: string, token: string): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const name = getEditSessionCookieName(secretId);
  document.cookie = `${name}=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secure}`;
}

export function hasEditSessionToken(secretId: string): boolean {
  const name = `${getEditSessionCookieName(secretId)}=`;
  return document.cookie.split(';').some((part) => part.trim().startsWith(name));
}
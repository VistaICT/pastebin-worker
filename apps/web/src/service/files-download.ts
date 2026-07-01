import type { SecretAttachment } from '@lockbox/types/api';

export async function downloadAttachment(file: SecretAttachment) {
  const response = await fetch(file.url, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Attachment download failed (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = file.name || 'attachment';
  link.click();
  URL.revokeObjectURL(objectUrl);
}

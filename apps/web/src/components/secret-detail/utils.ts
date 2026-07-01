import type { AttachmentDraft } from '@/components/secret-create/types';
import type { SecretAttachment } from '@/service';

export function buildAttachmentDrafts(
  attachments: SecretAttachment[] | undefined,
): AttachmentDraft[] {
  return (attachments ?? []).map((attachment) => ({
    attachment,
  }));
}

export function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

import { Paperclip } from 'lucide-react';

import type { SecretAttachment } from '@/service';

interface SecretAttachmentsPanelProps {
  attachments: SecretAttachment[];
  onOpenAttachment: (file: SecretAttachment) => void;
}

export default function SecretAttachmentsPanel({
  attachments,
  onOpenAttachment,
}: SecretAttachmentsPanelProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 dark:border-gray-800 dark:text-gray-300">
        Attachments ({attachments.length})
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {attachments.map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex items-center gap-2">
              <Paperclip size={14} className="shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{file.name}</p>
                <p className="text-xs text-gray-500">{file.mimeType || 'file'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenAttachment(file)}
              className="text-sm text-brand-600 hover:underline dark:text-brand-400"
            >
              Open
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

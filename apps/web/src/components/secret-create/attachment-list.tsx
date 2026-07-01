import { Paperclip, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { AttachmentDraft } from './types';

interface Props {
  attachments: AttachmentDraft[];
  onRemove: (id: string) => void;
  formatFileSize: (size: number) => string;
}

export default function AttachmentList({ attachments, onRemove, formatFileSize }: Props) {
  if (attachments.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300">
        Attachments ({attachments.length})
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {attachments.map((file) => (
          <li key={file.attachment.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0 flex items-center gap-2">
              <Paperclip size={14} className="shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-800 dark:text-gray-200">{file.attachment.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.attachment.size)}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-red-600"
              onClick={() => onRemove(file.attachment.id)}
              aria-label={`Remove ${file.attachment.name}`}
            >
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

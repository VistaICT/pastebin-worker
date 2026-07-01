import { Button } from '@/components/ui/button';

import type { UploadQueueItem } from './types';
import type { AttachmentTransferProgress } from '@/service';

interface Props {
  items: UploadQueueItem[];
  uploading: boolean;
  onCancelAll: () => void;
  formatFileSize: (size: number) => string;
}

export default function UploadQueue({ items, uploading, onCancelAll, formatFileSize }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 dark:border-gray-800 dark:text-gray-300">
        <span>Transfer queue ({items.length})</span>
        {uploading && (
          <Button type="button" variant="outline" size="sm" onClick={onCancelAll}>
            Cancel all
          </Button>
        )}
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800" aria-live="polite">
        {items.map((item) => {
          const isError = item.status === 'error';
          const isCancelled = item.status === 'cancelled';
          const statusLabel = item.status === 'processing'
            ? `${stageLabel(item.progress.stage)} ${Math.round(item.progress.overallProgress)}%`
            : item.status === 'success'
              ? 'Complete'
              : item.status === 'error'
                ? 'Failed'
                : item.status === 'cancelled'
                  ? 'Cancelled'
                  : 'Pending';
          const progressWidth = Math.max(0, Math.min(100, item.progress.overallProgress));

          return (
            <li key={item.id} className="px-3 py-2" aria-label={`${item.fileName} ${statusLabel}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-800 dark:text-gray-200">{item.fileName}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(item.size)}</p>
                </div>
                <span
                  className={[
                    'text-xs font-medium',
                    item.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : '',
                    item.status === 'processing' ? 'text-brand-600 dark:text-brand-400' : '',
                    isError ? 'text-red-600 dark:text-red-400' : '',
                    isCancelled ? 'text-amber-600 dark:text-amber-400' : '',
                    item.status === 'pending' ? 'text-gray-500 dark:text-gray-400' : '',
                  ].join(' ')}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div
                  className={[
                    'h-full rounded-full transition-[width] duration-200 ease-out',
                    isError
                      ? 'bg-red-500'
                      : isCancelled
                        ? 'bg-amber-500'
                        : item.status === 'success'
                          ? 'bg-emerald-500'
                          : 'bg-brand-500',
                  ].join(' ')}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
              {isError && item.error && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{item.error}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function stageLabel(stage: AttachmentTransferProgress['stage']) {
  switch (stage) {
    case 'preparing': return 'Preparing';
    case 'encrypting': return 'Encrypting';
    case 'uploading': return 'Uploading';
    case 'downloading': return 'Downloading';
    case 'decrypting': return 'Decrypting';
    case 'finalizing': return 'Finalizing';
    case 'complete': return 'Complete';
    default: return 'Processing';
  }
}

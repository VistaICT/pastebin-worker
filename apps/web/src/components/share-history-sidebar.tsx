import { X, Clock, FileText, File, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ShareStorage, type ShareItem } from '@/utils/share-storage';

interface Props {
  open: boolean;
  onClose: () => void;
}

function getItemHref(item: ShareItem): string | null {
  if (!item.content) return null;

  if (item.content.startsWith('/')) {
    return item.content;
  }

  try {
    const url = new URL(item.content);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return item.content;
    }
  } catch {
    return null;
  }

  return null;
}

export default function ShareHistorySidebar({ open, onClose }: Props) {
  const [items, setItems] = useState<ShareItem[]>([]);

  useEffect(() => {
    if (!open) return;

    setItems(ShareStorage.getAll());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="right-0 top-0 h-full w-full sm:w-80 bg-white shadow-xl dark:bg-gray-900 flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <DialogTitle className="font-semibold text-gray-900 dark:text-gray-50">Share history</DialogTitle>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-500 dark:hover:text-gray-100"
              aria-label="Close"
            >
              <X size={18} />
            </Button>
          </DialogClose>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-600 gap-2">
              <Clock size={28} />
              <p className="text-sm">No shares yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((item) => {
                const href = getItemHref(item);

                return (
                  <li key={item.id} className="px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <a
                      href={href ?? undefined}
                      onClick={(event) => {
                        if (!href) {
                          event.preventDefault();
                          return;
                        }
                        onClose();
                      }}
                      className="block"
                      aria-disabled={!href}
                    >
                      <div className="flex items-start gap-3">
                        {item.type === 'file'
                          ? <File size={16} className="mt-0.5 shrink-0 text-brand-500" />
                          : <FileText size={16} className="mt-0.5 shrink-0 text-gray-400" />
                        }
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{item.title}</p>
                            {href && <ExternalLink size={12} className="shrink-0 text-gray-400" aria-hidden="true" />}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-600">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                          {!href && (
                            <p className="text-xs text-gray-400 dark:text-gray-600">Legacy entry (no link)</p>
                          )}
                        </div>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

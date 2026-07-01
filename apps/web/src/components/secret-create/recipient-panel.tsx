import { ChangeEvent } from 'react';
import { Plus, X } from 'lucide-react';

import EmailInputField from '@/components/ui/email-input-field';
import { Button } from '@/components/ui/button';

import { getRecipientError } from './recipient-utils';
import type { RecipientEntry } from './types';

interface Props {
  entries: RecipientEntry[];
  onAdd: () => void;
  onRemoveAt: (index: number) => void;
  onSetAt: (index: number, value: string) => void;
  onMarkTouched: (index: number) => void;
}

export default function RecipientPanel({ entries, onAdd, onRemoveAt, onSetAt, onMarkTouched }: Props) {
  return (
    <aside className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">Recipients (required)</div>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Add at least one recipient. Each recipient must have a valid email address.
      </p>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800">
        {entries.map((entry, index) => {
          const error = getRecipientError(entry.email);
          const showError = entry.touched && Boolean(error);
          return (
            <div
              key={entry.id}
              className={[
                'space-y-2 p-2',
                index > 0 ? 'border-t border-gray-200 dark:border-gray-800' : '',
              ].join(' ')}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <EmailInputField
                    idPrefix={`recipient-${entry.id}`}
                    value={entry.email}
                    onChange={(value) => onSetAt(index, value)}
                    onBlur={() => onMarkTouched(index)}
                    error={error}
                    showError={showError}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-gray-500 hover:text-red-600"
                  onClick={() => onRemoveAt(index)}
                  aria-label={`Remove recipient ${index + 1}`}
                >
                  <X size={15} />
                </Button>
              </div>
            </div>
          );
        })}

        <div className="border-t border-gray-200 p-2 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed text-xs"
            onClick={onAdd}
          >
            <Plus size={14} className="mr-1" />
            Add recipient
          </Button>
        </div>
      </div>
    </aside>
  );
}

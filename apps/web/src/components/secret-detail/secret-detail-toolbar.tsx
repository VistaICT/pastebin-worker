import { Check, Copy, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface SecretDetailToolbarProps {
  canEdit: boolean;
  euJurisdiction: boolean;
  linkCopied: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  missingKey: boolean;
  detailContext: 'view' | 'edit';
  onCopyLink: () => void;
  onDelete: () => void;
  onToggleContext: () => void;
}

export default function SecretDetailToolbar({
  canEdit,
  euJurisdiction,
  linkCopied,
  isDeleting,
  isSaving,
  missingKey,
  detailContext,
  onCopyLink,
  onDelete,
  onToggleContext,
}: SecretDetailToolbarProps) {
  if (!canEdit) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Button onClick={onCopyLink} size="sm" className="gap-1.5">
          {linkCopied ? <Check size={14} /> : <Copy size={14} />}
          {linkCopied ? 'Copied!' : 'Copy link'}
        </Button>
        {euJurisdiction && (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400">
            EU jurisdiction
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting || isSaving}
        >
          <Trash2 size={14} />
          <span className="ml-1">{isDeleting ? 'Deleting…' : 'Delete'}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleContext}
          disabled={isSaving || isDeleting || missingKey}
        >
          {detailContext === 'view' ? 'Edit secret' : 'Back to view'}
        </Button>
      </div>
    </div>
  );
}

import { ChangeEvent, DragEvent, lazy, Suspense } from 'react';
import { Upload } from 'lucide-react';

import AttachmentList from '@/components/secret-create/attachment-list';
import RecipientPanel from '@/components/secret-create/recipient-panel';
import SettingsSection from '@/components/secret-create/settings-section';
import type { AttachmentDraft, RecipientEntry, UploadQueueItem } from '@/components/secret-create/types';
import UploadQueue from '@/components/secret-create/upload-queue';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/utils/format';

const SimpleEditor = lazy(() => import('@/components/tiptap-templates/simple/simple-editor'));

export interface SecretEditorPanelProps {
  editor: {
    content: string;
    onContentChange: (value: string) => void;
    previewMode: 'edit' | 'preview';
    onTogglePreviewMode?: () => void;
  };
  attachments: {
    items: AttachmentDraft[];
    onRemove: (id: string) => void;
    uploading: boolean;
    queue: UploadQueueItem[];
    onCancelUpload: () => void;
    onDrop: (event: DragEvent<HTMLLabelElement>) => Promise<void>;
    onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
    dragOver: boolean;
    onDragOver: (event: DragEvent<HTMLLabelElement>) => void;
    onDragLeave: () => void;
  };
  recipients: {
    entries: RecipientEntry[];
    onAdd: () => void;
    onRemoveAt: (index: number) => void;
    onSetAt: (index: number, value: string) => void;
    onMarkTouched: (index: number) => void;
  };
  settings: {
    expiryEnabled: boolean;
    expiration: number;
    onExpiryToggle: (checked: boolean) => void;
    onExpirationChange: (value: number) => void;
    clientEncryptionEnabled: boolean;
    onEncryptionToggle: (checked: boolean) => void;
    euJurisdiction: boolean;
    onEuJurisdictionToggle: (checked: boolean) => void;
    showEncryptionToggle?: boolean;
    showJurisdictionToggle?: boolean;
  };
  submit: {
    label: string;
    disabled: boolean;
    onSubmit: () => void;
  };
}

export default function SecretEditorPanel({ editor, attachments, recipients, settings, submit }: SecretEditorPanelProps) {
  const showEncryptionToggle = settings.showEncryptionToggle ?? true;
  const showJurisdictionToggle = settings.showJurisdictionToggle ?? true;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <Suspense
              fallback={
                <div className="min-h-[220px] rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                  Loading editor...
                </div>
              }
            >
              <SimpleEditor
                content={editor.content}
                onChange={editor.onContentChange}
                editable={editor.previewMode === 'edit'}
                mode={editor.previewMode}
                onModeToggle={editor.onTogglePreviewMode}
              />
            </Suspense>
          </div>

          <div className="space-y-3">
            <UploadQueue
              items={attachments.queue}
              uploading={attachments.uploading}
              onCancelAll={attachments.onCancelUpload}
              formatFileSize={formatBytes}
            />

            <label
              className={[
                'flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-sm transition-colors',
                attachments.dragOver
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20'
                  : 'border-gray-300 hover:border-brand-400 dark:border-gray-700 dark:hover:border-brand-600',
                attachments.uploading ? 'opacity-70 pointer-events-none' : '',
              ].join(' ')}
              onDrop={(event) => {
                void attachments.onDrop(event);
              }}
              onDragOver={attachments.onDragOver}
              onDragLeave={attachments.onDragLeave}
            >
              <Upload size={16} />
              <span>
                {attachments.uploading ? 'Uploading...' : 'Attach files (drop or browse)'}
              </span>
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => {
                  void attachments.onFileInputChange(event);
                }}
                disabled={attachments.uploading}
              />
            </label>

            <AttachmentList
              attachments={attachments.items}
              onRemove={attachments.onRemove}
              formatFileSize={formatBytes}
            />
          </div>
        </div>

        <RecipientPanel
          entries={recipients.entries}
          onAdd={recipients.onAdd}
          onRemoveAt={recipients.onRemoveAt}
          onSetAt={recipients.onSetAt}
          onMarkTouched={recipients.onMarkTouched}
        />
      </div>

      <SettingsSection
        expiryEnabled={settings.expiryEnabled}
        expiration={settings.expiration}
        onExpiryToggle={settings.onExpiryToggle}
        onExpirationChange={settings.onExpirationChange}
        clientEncryptionEnabled={settings.clientEncryptionEnabled}
        onEncryptionToggle={settings.onEncryptionToggle}
        euJurisdiction={settings.euJurisdiction}
        onEuJurisdictionToggle={settings.onEuJurisdictionToggle}
        showEncryptionToggle={showEncryptionToggle}
        showJurisdictionToggle={showJurisdictionToggle}
      />

      <Button onClick={submit.onSubmit} disabled={submit.disabled} className="w-full sm:w-auto">
        {submit.label}
      </Button>
    </div>
  );
}

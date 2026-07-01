import { useNavigate } from 'react-router-dom';

import SecretEditorPanel, { type SecretEditorPanelProps } from '@/components/secret-editor/secret-editor-panel';
import {
  addRecipientEntry,
  markRecipientEntryTouched,
  removeRecipientEntryAt,
  setRecipientEntryAt,
} from '@/components/secret-editor/recipient-entry-state';
import RecipientVerificationCard from './recipient-verification-card';
import SecretAttachmentsPanel from './secret-attachments-panel';
import SecretDetailToolbar from './secret-detail-toolbar';
import SecretPreviewPanel from './secret-preview-panel';
import { useSecretDetailState } from './hooks/use-secret-detail-state';

interface SecretDetailViewProps {
  secretId: string;
}

export default function SecretDetailView({ secretId }: SecretDetailViewProps) {
  const navigate = useNavigate();
  const model = useSecretDetailState({
    secretId,
    onDeleted: () => navigate('/', { replace: true }),
  });

  if (model.status.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
        Loading…
      </div>
    );
  }

  if (!model.status.isAuth) {
    return (
      <RecipientVerificationCard
        accessHint={model.status.accessHint}
        recipientEmail={model.otp.recipientEmail}
        otpCode={model.otp.otpCode}
        otpRequested={model.otp.otpRequested}
        otpLoading={model.otp.otpLoading}
        otpVerifyLoading={model.otp.otpVerifyLoading}
        otpRetryAfter={model.otp.otpRetryAfter}
        onRecipientEmailChange={model.otp.setRecipientEmail}
        onOtpCodeChange={model.otp.setOtpCode}
        onSendOtp={() => {
          void model.otp.send();
        }}
        onVerifyOtp={() => {
          void model.otp.verify();
        }}
      />
    );
  }

  const editPanelProps: SecretEditorPanelProps = {
    editor: {
      content: model.editor.content,
      onContentChange: model.editor.setContent,
      previewMode: 'edit',
    },
    attachments: {
      items: model.attachments.drafts,
      onRemove: (attachmentId) => model.attachments.setDrafts((prev) => prev.filter((item) => item.attachment.id !== attachmentId)),
      uploading: model.attachments.uploading,
      queue: model.attachments.queue,
      onCancelUpload: () => model.attachments.uploadAbortController?.abort(),
      onDrop: async (event) => {
        event.preventDefault();
        model.attachments.setDragOver(false);
        const items = Array.from(event.dataTransfer.items ?? []);
        if (items.length > 0 && !items.some((item) => item.kind === 'file')) {
          return;
        }
        const files = Array.from(event.dataTransfer.files ?? []);
        await model.attachments.upload(files);
      },
      onFileInputChange: async (event) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        await model.attachments.upload(files);
      },
      dragOver: model.attachments.dragOver,
      onDragOver: (event) => {
        event.preventDefault();
        model.attachments.setDragOver(true);
      },
      onDragLeave: () => model.attachments.setDragOver(false),
    },
    recipients: {
      entries: model.recipients.entries,
      onAdd: () => model.recipients.setEntries((prev) => addRecipientEntry(prev)),
      onRemoveAt: (index) => model.recipients.setEntries((prev) => removeRecipientEntryAt(prev, index)),
      onSetAt: (index, value) => model.recipients.setEntries((prev) => setRecipientEntryAt(prev, index, value)),
      onMarkTouched: (index) => model.recipients.setEntries((prev) => markRecipientEntryTouched(prev, index)),
    },
    settings: {
      expiryEnabled: model.settings.expiryEnabled,
      expiration: model.settings.expiration,
      onExpiryToggle: (checked) => {
        model.settings.setExpiryEnabled(checked);
        if (checked && model.settings.expiration === 0) {
          model.settings.setExpiration(86400);
        }
      },
      onExpirationChange: model.settings.setExpiration,
      clientEncryptionEnabled: model.settings.clientEncryptionEnabled,
      onEncryptionToggle: () => {},
      euJurisdiction: model.settings.euJurisdiction,
      onEuJurisdictionToggle: () => {},
      showEncryptionToggle: false,
      showJurisdictionToggle: false,
    },
    submit: {
      label: model.editor.isSaving ? 'Saving…' : 'Save changes',
      disabled: model.editor.isSaving || model.editor.isDeleting || model.attachments.uploading || !model.editor.canSaveSecret,
      onSubmit: () => {
        void model.editor.save();
      },
    },
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <SecretDetailToolbar
        canEdit={model.status.canEdit}
        euJurisdiction={model.status.euJurisdiction}
        linkCopied={model.status.linkCopied}
        isDeleting={model.editor.isDeleting}
        isSaving={model.editor.isSaving}
        missingKey={model.status.missingKey}
        detailContext={model.editor.detailContext}
        onCopyLink={() => {
          void model.editor.copyLink();
        }}
        onDelete={() => {
          void model.editor.delete();
        }}
        onToggleContext={() => model.editor.setDetailContext((prev) => (prev === 'view' ? 'edit' : 'view'))}
      />

      {model.editor.detailContext === 'edit' && model.status.canEdit ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          <SecretEditorPanel {...editPanelProps} />
        </div>
      ) : (
        <>
          <SecretPreviewPanel content={model.editor.content} />

          <SecretAttachmentsPanel
            attachments={model.attachments.list}
            onOpenAttachment={(file) => {
              void model.attachments.open(file);
            }}
          />
        </>
      )}

      {model.status.missingKey && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          This secret is encrypted. You need the full link, including the #k= fragment, to decrypt or edit it in the browser.
        </div>
      )}
    </div>
  );
}

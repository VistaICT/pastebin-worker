import { lazy, Suspense } from 'react';

import CopyButton from '@/components/ui/copy-button';

const SimpleEditor = lazy(() => import('@/components/tiptap-templates/simple/simple-editor'));

interface SecretPreviewPanelProps {
  content: string;
}

export default function SecretPreviewPanel({ content }: SecretPreviewPanelProps) {
  if (content.trim().length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="absolute right-3 top-3 z-10">
        <CopyButton text={content} label="Copy content" />
      </div>
      <Suspense fallback={<div className="min-h-[320px] p-4 text-sm text-gray-500 dark:text-gray-400">Loading preview…</div>}>
        <SimpleEditor content={content} onChange={() => {}} editable={false} mode="preview" />
      </Suspense>
    </div>
  );
}

import { useState } from 'react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import CopyButton from '@/components/ui/copy-button';
import { uploadFile } from '@/service';
import { formatBytes } from '@/utils/format';
import { ShareStorage } from '@/utils/share-storage';
import JurisdictionToggle from '@/components/file-share/jurisdiction-toggle';

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export default function FileShare() {
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [euJurisdiction, setEuJurisdiction] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > MAX_SIZE) {
      toast.error('File exceeds 25 MB limit');
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    setUploading(true);
    const tid = toast.loading('Uploading…');
    try {
      const data = await uploadFile({ file, euJurisdiction });
      toast.dismiss(tid);
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setFileUrl(data.url!);
      toast.success(`Uploaded — expires in ${data.expireDays} days`);
      ShareStorage.save({ title: file.name, content: data.url!, type: 'file', fileName: file.name, fileSize: file.size });
    } catch {
      toast.dismiss(tid);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const items = Array.from(e.dataTransfer.items ?? []);
    if (items.length > 0 && !items.some((item) => item.kind === 'file')) {
      toast.error('Only file drops are supported');
      return;
    }

    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <label
        className={[
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors',
          dragOver
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20'
            : 'border-gray-300 hover:border-brand-400 dark:border-gray-700 dark:hover:border-brand-600',
        ].join(' ')}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <svg className="h-10 w-10 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Drop file here or <span className="text-brand-600 dark:text-brand-400">browse</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Up to 25 MB · expires in 15 days</p>
        </div>
        <input type="file" className="sr-only" onChange={onInputChange} disabled={uploading} />
      </label>

      {/* Options */}
      <div className="flex items-center gap-4">
        <JurisdictionToggle value={euJurisdiction} onChange={setEuJurisdiction} />
      </div>

      {/* Result */}
      {fileUrl && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{fileName}</p>
              <p className="text-xs text-gray-500">{formatBytes(fileSize)}</p>
            </div>
            <CopyButton text={fileUrl} label="Copy link" />
          </div>
          <a
            href={fileUrl}
            className="mt-2 block truncate text-xs text-brand-600 dark:text-brand-400 hover:underline"
          >
            {fileUrl}
          </a>
        </div>
      )}
    </div>
  );
}

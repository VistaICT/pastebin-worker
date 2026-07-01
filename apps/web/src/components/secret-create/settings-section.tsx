import { Info } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const EXPIRY_OPTIONS = [
  { label: 'Never', value: 0 },
  { label: '1 hour', value: 3600 },
  { label: '24 hours', value: 86400 },
  { label: '7 days', value: 604800 },
  { label: '30 days', value: 2592000 },
];

interface Props {
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
}

export default function SettingsSection({
  expiryEnabled,
  expiration,
  onExpiryToggle,
  onExpirationChange,
  clientEncryptionEnabled,
  onEncryptionToggle,
  euJurisdiction,
  onEuJurisdictionToggle,
  showEncryptionToggle = true,
  showJurisdictionToggle = true,
}: Props) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      <div className="py-3">
        <div className="flex items-start gap-3">
          <Switch
            checked={expiryEnabled}
            onCheckedChange={onExpiryToggle}
            aria-label="Toggle expiration"
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">Expires</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Automatically delete after a time period</div>
          </div>
        </div>

        {expiryEnabled && (
          <div className="pl-14 pt-2">
            <Select value={String(expiration)} onValueChange={(v) => onExpirationChange(Number(v))}>
              <SelectTrigger className="h-9 w-full max-w-[12rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {showEncryptionToggle && (
        <div className="py-3">
          <div className="flex items-start gap-3">
            <Switch
              checked={clientEncryptionEnabled}
              onCheckedChange={onEncryptionToggle}
              aria-label="Toggle client-side encryption"
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
                <span>Client-side encryption</span>
                <span
                  className="inline-flex text-gray-400"
                  title="CSE (Client-Side Encryption) means your secret text is encrypted in your browser before it is sent. The key stays in the URL fragment (#k=) and is not sent to the server."
                  aria-label="About client-side encryption"
                >
                  <Info size={14} />
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Encrypt secret text in your browser before upload</div>
            </div>
          </div>
        </div>
      )}

      {showJurisdictionToggle && (
        <div className="py-3">
          <div className="flex items-start gap-3">
            <Switch
              checked={euJurisdiction}
              onCheckedChange={onEuJurisdictionToggle}
              aria-label="Toggle EU jurisdiction"
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">EU jurisdiction</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Store files in EU region only</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

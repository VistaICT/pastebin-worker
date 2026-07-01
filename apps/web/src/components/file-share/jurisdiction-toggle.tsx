import { Globe, ShieldCheck } from 'lucide-react';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
}

/**
 * Toggle between global and EU-jurisdiction data storage.
 */
export default function JurisdictionToggle({ value, onChange }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        value
          ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700/60 dark:bg-blue-950/30 dark:text-blue-400'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
      ].join(' ')}
      title={value ? 'EU jurisdiction active - click to switch to global' : 'Click to use EU jurisdiction'}
    >
      {value ? (
        <>
          <ShieldCheck size={12} />
          EU jurisdiction
        </>
      ) : (
        <>
          <Globe size={12} />
          Global
        </>
      )}
    </button>
  );
}

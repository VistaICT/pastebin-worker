import { Input } from '@/components/ui/input';

interface EmailInputFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string | null;
  showError?: boolean;
  idPrefix: string;
  inputClassName?: string;
}

export default function EmailInputField({
  value,
  onChange,
  onBlur,
  placeholder = 'name@example.com',
  error,
  showError = false,
  idPrefix,
  inputClassName = '',
}: EmailInputFieldProps) {
  const hasError = showError && Boolean(error);
  const errorId = `${idPrefix}-error`;

  return (
    <>
      <Input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={hasError ? `border-red-500 focus:border-red-500 ${inputClassName}`.trim() : inputClassName}
      />
      {hasError && (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </>
  );
}
import EmailInputField from '@/components/ui/email-input-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validateSingleRecipientEmail } from '@/components/secret-create/recipient-utils';

import { formatCountdown } from './utils';

interface RecipientVerificationCardProps {
  accessHint: string;
  recipientEmail: string;
  otpCode: string;
  otpRequested: boolean;
  otpLoading: boolean;
  otpVerifyLoading: boolean;
  otpRetryAfter: number;
  onRecipientEmailChange: (value: string) => void;
  onOtpCodeChange: (value: string) => void;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
}

export default function RecipientVerificationCard({
  accessHint,
  recipientEmail,
  otpCode,
  otpRequested,
  otpLoading,
  otpVerifyLoading,
  otpRetryAfter,
  onRecipientEmailChange,
  onOtpCodeChange,
  onSendOtp,
  onVerifyOtp,
}: RecipientVerificationCardProps) {
  const emailError = validateSingleRecipientEmail(recipientEmail);
  const showEmailError = recipientEmail.trim().length > 0 && Boolean(emailError);

  return (
    <div className="mx-auto mt-20 max-w-md px-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
          Recipient verification required
        </h2>
        {accessHint && (
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{accessHint}</p>
        )}
        <div className="space-y-3">
          <EmailInputField
            idPrefix="recipient-verification"
            placeholder="Recipient email"
            value={recipientEmail}
            onChange={onRecipientEmailChange}
            error={emailError}
            showError={showEmailError}
            inputClassName="w-full"
          />
          {otpRequested && (
            <Input
              placeholder="6-digit verification code"
              value={otpCode}
              onChange={(e) => onOtpCodeChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onVerifyOtp()}
              className="w-full"
            />
          )}
          {!otpRequested ? (
            <div className="flex">
              <Button onClick={onSendOtp} disabled={otpLoading || showEmailError}>
                {otpLoading ? 'Sending…' : 'Send code'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button onClick={onVerifyOtp} disabled={otpVerifyLoading || showEmailError}>
                {otpVerifyLoading ? 'Verifying…' : 'Verify'}
              </Button>
              <Button
                variant="outline"
                onClick={onSendOtp}
                disabled={otpLoading || otpRetryAfter > 0 || showEmailError}
                className="ml-auto"
              >
                {otpLoading
                  ? 'Sending…'
                  : otpRetryAfter > 0
                    ? `Resend in ${formatCountdown(otpRetryAfter)}`
                    : 'Resend code'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

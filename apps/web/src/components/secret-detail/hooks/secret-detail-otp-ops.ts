import { toast } from 'react-hot-toast';

import { validateSingleRecipientEmail } from '@/components/secret-create/recipient-utils';
import { sendRecipientOtp, verifyRecipientOtp } from '@/service';
import { formatCountdown } from '../utils';

interface SendOtpParams {
  secretId: string;
  recipientEmail: string;
  otpRetryAfter: number;
  setOtpLoading: (value: boolean) => void;
  setOtpRetryAfter: (value: number) => void;
  setOtpRequested: (value: boolean) => void;
}

export async function sendOtp(params: SendOtpParams) {
  const { secretId, recipientEmail, otpRetryAfter, setOtpLoading, setOtpRetryAfter, setOtpRequested } = params;

  const emailError = validateSingleRecipientEmail(recipientEmail);
  if (emailError) {
    toast.error(emailError);
    return;
  }

  if (!secretId) {
    toast.error('Enter a recipient email address');
    return;
  }

  if (otpRetryAfter > 0) {
    toast.error(`Please wait ${formatCountdown(otpRetryAfter)} before requesting another code`);
    return;
  }

  setOtpLoading(true);
  const data = await sendRecipientOtp(secretId, recipientEmail.trim());
  setOtpLoading(false);

  if (data.error) {
    if (data.code === 429 && typeof data.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0) {
      setOtpRetryAfter(data.retryAfterSeconds);
      toast.error(`Please wait ${formatCountdown(data.retryAfterSeconds)} before requesting another code`);
      return;
    }
    toast.error(data.error);
    return;
  }

  setOtpRetryAfter(60);
  setOtpRequested(true);
  toast.success('Verification code sent');
}

interface VerifyOtpParams {
  secretId: string;
  recipientEmail: string;
  otpCode: string;
  setOtpVerifyLoading: (value: boolean) => void;
  setOtpCode: (value: string) => void;
  reloadSecret: () => Promise<void>;
}

export async function verifyOtp(params: VerifyOtpParams) {
  const { secretId, recipientEmail, otpCode, setOtpVerifyLoading, setOtpCode, reloadSecret } = params;

  const emailError = validateSingleRecipientEmail(recipientEmail);
  if (emailError) {
    toast.error(emailError);
    return;
  }

  if (!secretId || !otpCode.trim()) {
    toast.error('Enter your email and verification code');
    return;
  }

  setOtpVerifyLoading(true);
  const data = await verifyRecipientOtp(secretId, recipientEmail.trim(), otpCode.trim());
  setOtpVerifyLoading(false);

  if (data.error) {
    toast.error(data.error);
    return;
  }

  setOtpCode('');
  await reloadSecret();
}

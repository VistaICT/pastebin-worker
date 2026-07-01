/// <reference types="@cloudflare/workers-types" />
import type { EmailMessage } from "cloudflare:email";

interface Env {
  FROM_ADDRESS: string;
  FROM_NAME: string;
  EMAIL: {
    send(message: EmailMessage): Promise<{ messageId: string }>;
  };
}

/**
 * Lockbox Email Worker
 *
 * Responsible for sending transactional emails on behalf of Lockbox:
 *   - Secret share notifications
 *   - Guest invite links
 *   - Expiry warnings
 *
 * Outbound email uses Cloudflare Email Routing + MailChannels integration.
 * Configure the `[[send_email]]` binding in wrangler.toml to enable sending.
 *
 * This worker accepts HTTP POST requests from the API worker (via Service Binding
 * or direct HTTP) to queue email sends.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body: EmailRequest;
    try {
      body = (await request.json()) as EmailRequest;
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    if (!body.to) {
      return new Response('Missing required field: to', { status: 400 });
    }

    const payload = body.kind === 'recipient-otp'
      ? {
        to: body.to,
        subject: 'Your Lockbox verification code',
        html: recipientOtpEmailHtml({
          otpCode: body.otpCode,
          expiresInMinutes: body.expiresInMinutes,
        }),
        text: `Your Lockbox verification code is ${body.otpCode}. It expires in ${body.expiresInMinutes} minutes.`,
      }
      : {
        to: body.to,
        subject: body.subject,
        html: body.html,
        text: body.text,
      };

    if (!payload.subject || (!payload.html && !payload.text)) {
      return new Response('Missing required fields: subject, html|text', { status: 400 });
    }

    try {
      const messageId = await sendEmail(env, payload);
      return Response.json({ ok: true, messageId });
    } catch (err) {
      const code = (err as any).code ?? 'UNKNOWN';
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          message: '[lockbox-email] send failed',
          code,
          error: msg,
          to: payload.to,
        }),
      );
      // Map Cloudflare error codes to HTTP status
      const statusMap: Record<string, number> = {
        'E_SENDER_NOT_VERIFIED': 400,
        'E_RECIPIENT_NOT_ALLOWED': 400,
        'E_VALIDATION_ERROR': 400,
        'E_RATE_LIMIT_EXCEEDED': 429,
        'E_DAILY_LIMIT_EXCEEDED': 429,
      };
      const status = statusMap[code] ?? 502;
      return Response.json({ error: msg, code }, { status });
    }
  },
} satisfies ExportedHandler<Env>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailRequest =
  | {
    kind: 'recipient-otp';
    to: string;
    otpCode: string;
    expiresInMinutes: number;
  }
  | {
    kind?: 'generic';
    to: string;
    subject: string;
    html?: string;
    text?: string;
  };

// ---------------------------------------------------------------------------
// Email sending via Cloudflare Email Service
// ---------------------------------------------------------------------------
// https://developers.cloudflare.com/email-service/api/send-emails/workers-api/

async function sendEmail(
  env: Env,
  { to, subject, html, text }: { to: string; subject: string; html?: string; text?: string },
): Promise<string> {
  try {
    const payload = {
      to,
      from: env.FROM_ADDRESS,
      subject,
      html,
      text,
    };
    const result = await env.EMAIL.send(payload as unknown as EmailMessage);
    return result.messageId;
  } catch (err) {
    // Rethrow with code attached for handler to catch
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Email template helpers (import and use in fetch handler above)
// ---------------------------------------------------------------------------

export function inviteEmailHtml(params: {
  inviterName: string;
  inviterEmail: string;
  inviteUrl: string;
  expiresAt?: Date;
}): string {
  const expiry = params.expiresAt
    ? `<p>This link expires on <strong>${params.expiresAt.toUTCString()}</strong>.</p>`
    : '';
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Lockbox Invite</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
  <h1 style="color:#1e293b">🔒 Lockbox — Secure Share Invite</h1>
  <p>
    <strong>${escapeHtml(params.inviterName)}</strong>
    (${escapeHtml(params.inviterEmail)}) has invited you to submit a secure secret.
  </p>
  <p>
    <a href="${escapeHtml(params.inviteUrl)}"
       style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none">
      Open Lockbox invite
    </a>
  </p>
  ${expiry}
  <hr style="margin-top:32px;border:none;border-top:1px solid #e2e8f0">
  <p style="color:#64748b;font-size:12px">
    If you were not expecting this email, you can safely ignore it.
  </p>
</body>
</html>`;
}

export function recipientOtpEmailHtml(params: {
  otpCode: string;
  expiresInMinutes: number;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Lockbox Verification Code</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
  <h1 style="color:#1e293b">Lockbox verification code</h1>
  <p>Use the following code to verify access to your secret:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:0.12em;color:#0f172a">${escapeHtml(params.otpCode)}</p>
  <p>This code expires in <strong>${params.expiresInMinutes} minutes</strong>.</p>
  <hr style="margin-top:32px;border:none;border-top:1px solid #e2e8f0">
  <p style="color:#64748b;font-size:12px">
    If you were not expecting this email, you can safely ignore it.
  </p>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

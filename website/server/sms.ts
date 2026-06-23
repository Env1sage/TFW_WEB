/**
 * Shared SMS utility — supports MSG91 (primary) and Fast2SMS (fallback).
 * Set SMS_PROVIDER=msg91 in .env along with MSG91_AUTH_KEY + MSG91_OTP_TEMPLATE_ID.
 */

const SMS_PROVIDER       = process.env.SMS_PROVIDER || '';
const MSG91_AUTH_KEY     = process.env.MSG91_AUTH_KEY || '';
const MSG91_OTP_TEMPLATE = process.env.MSG91_OTP_TEMPLATE_ID || '';
const MSG91_SENDER_ID    = process.env.MSG91_SENDER_ID || 'TFWALL';
const FAST2SMS_API_KEY   = process.env.FAST2SMS_API_KEY || '';

export interface SMSResult {
  ok: boolean;
  provider: string;
  message?: string;
  raw?: any;
}

// ── MSG91 ──────────────────────────────────────────────────────────────────────

async function sendViaMSG91OTP(phone: string, otp: string): Promise<SMSResult> {
  if (!MSG91_AUTH_KEY || !MSG91_OTP_TEMPLATE) {
    return { ok: false, provider: 'msg91', message: 'MSG91_AUTH_KEY or MSG91_OTP_TEMPLATE_ID not set' };
  }

  const res = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      authkey: MSG91_AUTH_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: MSG91_OTP_TEMPLATE,
      mobile: `91${phone}`,
      otp,
      otp_expiry: 5,           // minutes
      sender: MSG91_SENDER_ID,
    }),
  });

  const raw = await res.json().catch(() => ({}));
  console.log('[MSG91 OTP]', JSON.stringify(raw));

  if (!res.ok || raw.type === 'error') {
    return { ok: false, provider: 'msg91', message: raw.message || `HTTP ${res.status}`, raw };
  }
  return { ok: true, provider: 'msg91', message: raw.message, raw };
}

async function sendViaMSG91Flow(phone: string, templateId: string, variables: Record<string, string>): Promise<SMSResult> {
  if (!MSG91_AUTH_KEY) {
    return { ok: false, provider: 'msg91', message: 'MSG91_AUTH_KEY not set' };
  }

  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      authkey: MSG91_AUTH_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      mobiles: `91${phone}`,
      ...variables,
    }),
  });

  const raw = await res.json().catch(() => ({}));
  console.log('[MSG91 Flow]', JSON.stringify(raw));

  if (!res.ok || raw.type === 'error') {
    return { ok: false, provider: 'msg91', message: raw.message || `HTTP ${res.status}`, raw };
  }
  return { ok: true, provider: 'msg91', message: raw.message, raw };
}

// ── Fast2SMS ───────────────────────────────────────────────────────────────────

async function sendViaFast2SMS(phone: string, otp: string): Promise<SMSResult> {
  if (!FAST2SMS_API_KEY) {
    return { ok: false, provider: 'fast2sms', message: 'FAST2SMS_API_KEY not set' };
  }

  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: { authorization: FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ route: 'otp', variables_values: otp, flash: 0, numbers: phone }),
  });

  const raw = await res.json().catch(() => ({}));
  console.log('[Fast2SMS]', JSON.stringify(raw));

  if (!res.ok || raw.return === false) {
    return { ok: false, provider: 'fast2sms', message: raw.message?.[0] || `HTTP ${res.status}`, raw };
  }
  return { ok: true, provider: 'fast2sms', message: 'sent', raw };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Send an OTP via the configured SMS provider. Throws on failure in prod. */
export async function sendOtpSMS(phone: string, otp: string): Promise<void> {
  if (SMS_PROVIDER === 'msg91') {
    const result = await sendViaMSG91OTP(phone, otp);
    if (!result.ok) throw new Error(`MSG91: ${result.message}`);
    return;
  }

  if (SMS_PROVIDER === 'fast2sms') {
    const result = await sendViaFast2SMS(phone, otp);
    if (!result.ok) throw new Error(`Fast2SMS: ${result.message}`);
    return;
  }

  // Dev fallback — log to console
  console.log(`\n[OTP DEV] 📱 Phone: +91${phone}  |  OTP: ${otp}\n`);
}

/** Send a transactional SMS via MSG91 Flow (back-in-stock, order updates, etc.). Non-fatal. */
export async function sendTransactionalSMS(phone: string, templateId: string, variables: Record<string, string>): Promise<void> {
  if (SMS_PROVIDER === 'msg91') {
    const result = await sendViaMSG91Flow(phone, templateId, variables);
    if (!result.ok) console.error('[SMS] Transactional send failed:', result.message);
    return;
  }
  console.log(`[SMS DEV] Transactional to +91${phone}:`, variables);
}

/** Test the SMS configuration. Returns a result object — never throws. */
export async function testSMSConfig(phone: string): Promise<SMSResult & { configured: boolean }> {
  const configured = !!(
    (SMS_PROVIDER === 'msg91'     && MSG91_AUTH_KEY && MSG91_OTP_TEMPLATE) ||
    (SMS_PROVIDER === 'fast2sms'  && FAST2SMS_API_KEY)
  );

  if (!configured) {
    return {
      ok: false,
      configured: false,
      provider: SMS_PROVIDER || 'none',
      message: SMS_PROVIDER
        ? `${SMS_PROVIDER} selected but credentials not set in .env`
        : 'SMS_PROVIDER not set (set to msg91 or fast2sms)',
    };
  }

  try {
    const testOtp = '123456';
    if (SMS_PROVIDER === 'msg91') {
      const r = await sendViaMSG91OTP(phone, testOtp);
      return { ...r, configured };
    }
    if (SMS_PROVIDER === 'fast2sms') {
      const r = await sendViaFast2SMS(phone, testOtp);
      return { ...r, configured };
    }
    return { ok: false, configured, provider: 'none', message: 'No provider configured' };
  } catch (e: any) {
    return { ok: false, configured, provider: SMS_PROVIDER, message: e.message };
  }
}

export function getSMSConfig() {
  return {
    provider: SMS_PROVIDER || 'none',
    msg91Configured:    !!(MSG91_AUTH_KEY && MSG91_OTP_TEMPLATE),
    fast2smsConfigured: !!FAST2SMS_API_KEY,
    senderId: MSG91_SENDER_ID,
  };
}

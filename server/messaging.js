// One place that sends WhatsApp / SMS — used for login codes and proactive nudges.
//   MESSAGE_PROVIDER (or legacy OTP_PROVIDER):
//     console          print to the server log (default; fine for a small pilot)
//     twilio_whatsapp  Twilio WhatsApp API
//     twilio_sms       Twilio SMS
//     webhook          POST {to, text, kind} as JSON to MESSAGE_WEBHOOK_URL — use this to plug in
//                      Zoho CPaaS, Gupshup, MSG91, Interakt… through a tiny relay or their HTTP API.
import { config } from './config.js';

export async function sendMessage(phone, text, { kind = 'otp', channel } = {}) {
  const provider = config.messageProvider;
  if (provider === 'webhook') {
    if (!config.messageWebhookUrl) throw new Error('MESSAGE_WEBHOOK_URL is not set');
    const res = await fetch(config.messageWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.messageWebhookToken ? { Authorization: `Bearer ${config.messageWebhookToken}` } : {}),
      },
      body: JSON.stringify({ to: phone, text, kind }),
    });
    if (!res.ok) throw new Error(`Message webhook failed (${res.status})`);
    return 'webhook';
  }
  if (provider.startsWith('twilio') && config.twilioSid) {
    const useWhatsApp = provider === 'twilio_whatsapp' && channel !== 'sms';
    const from = useWhatsApp && !config.twilioFrom.startsWith('whatsapp:') ? `whatsapp:${config.twilioFrom}` : config.twilioFrom;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: useWhatsApp ? `whatsapp:${phone}` : phone, Body: text }),
    });
    if (!res.ok) {
      console.error('[messaging] Twilio error', res.status, (await res.text()).slice(0, 300));
      throw new Error('Twilio send failed');
    }
    return useWhatsApp ? 'whatsapp' : 'sms';
  }
  console.log(`[message:${kind}] ${phone} → ${text}`);
  return 'console';
}

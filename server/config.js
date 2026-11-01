import path from 'node:path';

const env = process.env;
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

export const config = {
  port: num(env.PORT, 3000),
  dataDir: path.resolve(env.DATA_DIR || './data'),
  sessionSecret: env.SESSION_SECRET || 'dev-secret-change-me',
  cookieSecure: env.COOKIE_SECURE === '1',

  openaiKey: env.OPENAI_API_KEY || '',
  openaiBase: (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
  sttModel: env.OPENAI_STT_MODEL || 'gpt-4o-transcribe',
  chatModel: env.OPENAI_CHAT_MODEL || 'gpt-4.1-mini',
  reasoningEffort: env.OPENAI_REASONING_EFFORT || '',
  ttsModel: env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
  ttsVoice: env.OPENAI_TTS_VOICE || 'coral',
  mockAi: env.MOCK_AI === '1' || (!env.OPENAI_API_KEY && env.NODE_ENV === 'test'),

  otpProvider: env.OTP_PROVIDER || 'console',
  twilioSid: env.TWILIO_ACCOUNT_SID || '',
  twilioToken: env.TWILIO_AUTH_TOKEN || '',
  twilioFrom: env.TWILIO_FROM || '',
  otpTestNumbers: (env.OTP_TEST_NUMBERS || '').split(',').map((s) => s.trim()).filter(Boolean),
  otpTestCode: env.OTP_TEST_CODE || '',
  otpResendSeconds: num(env.OTP_RESEND_SECONDS, 30),

  freeTrialSessions: num(env.FREE_TRIAL_SESSIONS, 7),
  dailySessionLimit: num(env.DAILY_SESSION_LIMIT, 5),
  upgradeUrl: env.UPGRADE_URL || '',
  upgradePriceText: env.UPGRADE_PRICE_TEXT || '₹149 / month',
  adminToken: env.ADMIN_TOKEN || '',

  timeZone: 'Asia/Kolkata',
};

if (!config.openaiKey && !config.mockAi) {
  console.warn('[config] OPENAI_API_KEY is not set. Set it in .env, or run with MOCK_AI=1 for a UI-only demo.');
}
if (config.sessionSecret === 'dev-secret-change-me') {
  console.warn('[config] SESSION_SECRET is not set — using an insecure default. Set it before going live.');
}

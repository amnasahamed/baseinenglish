// Guest-first identity + phone/WhatsApp OTP login.
// Every visitor gets a signed cookie for a guest user immediately (no signup wall).
// Verifying a phone number turns that guest into a saved account (or merges it into an existing one).
import crypto from 'node:crypto';
import { config } from './config.js';
import { sendMessage } from './messaging.js';
import { db, createUser, getUser, getUserByPhone, mergeUsers, touchUser, logEvent } from './db.js';

const COOKIE = 'bie_uid';
const MAX_AGE = 365 * 24 * 3600;

const sign = (v) => crypto.createHmac('sha256', config.sessionSecret).update(v).digest('base64url');

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setUserCookie(res, userId) {
  const value = `${userId}.${sign(userId)}`;
  res.append(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${config.cookieSecure ? '; Secure' : ''}`,
  );
}

function readUserCookie(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE];
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  if (i < 0) return null;
  const id = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const expected = sign(id);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return id;
}

/** Middleware: attaches req.user, creating a guest when needed. */
export function identify(req, res, next) {
  let user = getUser(readUserCookie(req));
  if (!user) {
    user = createUser();
    setUserCookie(res, user.id);
    logEvent(user.id, 'guest_created', { ua: String(req.headers['user-agent'] || '').slice(0, 120), ref: req.query.ref || null });
  } else {
    touchUser(user.id);
  }
  req.user = user;
  next();
}

// ─── OTP ─────────────────────────────────────────────────────
export function normalizePhone(input) {
  let p = String(input || '').replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (!p.startsWith('+')) {
    p = p.replace(/^0+/, '');
    if (p.length === 10) p = '+91' + p; // Indian mobile without country code
    else p = '+' + p;
  }
  return /^\+\d{8,15}$/.test(p) ? p : null;
}

/** Pilot mode: OTP_TEST_NUMBERS="*" lets every number log in with OTP_TEST_CODE (no SMS/WhatsApp needed). */
export function isFixedCodeNumber(phone) {
  if (!config.otpTestCode) return false;
  return config.otpTestNumbers.includes('*') || config.otpTestNumbers.includes(phone);
}

const hashCode = (phone, code) => crypto.createHash('sha256').update(`${config.sessionSecret}|${phone}|${code}`).digest('hex');

export async function requestOtp(phone, channel) {
  const existing = db.prepare('SELECT * FROM otps WHERE phone = ?').get(phone);
  if (existing && Date.now() - existing.sent_at < config.otpResendSeconds * 1000) {
    const err = new Error(`Please wait ${config.otpResendSeconds} seconds before asking for a new code.`);
    err.status = 429;
    throw err;
  }
  const isTest = isFixedCodeNumber(phone);
  const code = isTest ? config.otpTestCode : String(crypto.randomInt(100000, 1000000));
  db.prepare(
    `INSERT INTO otps (phone, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`,
  ).run(phone, hashCode(phone, code), Date.now() + 10 * 60_000, Date.now());
  if (!isTest) await deliverOtp(phone, code, channel);
}

async function deliverOtp(phone, code, channel) {
  try {
    await sendMessage(phone, `${code} is your Base in English login code. It expires in 10 minutes.`, { kind: 'otp', channel });
  } catch (e) {
    console.error('[otp]', e.message);
    const err = new Error('Could not send the code right now. Please try again.');
    err.status = 502;
    throw err;
  }
}

/** Verifies the code and returns the user id the browser should now be logged in as. */
export function verifyOtp(req, res, phone, code) {
  const row = db.prepare('SELECT * FROM otps WHERE phone = ?').get(phone);
  const fail = (msg) => {
    const err = new Error(msg);
    err.status = 400;
    return err;
  };
  if (!row || row.expires_at < Date.now()) throw fail('This code has expired. Please ask for a new one.');
  if (row.attempts >= 5) throw fail('Too many wrong tries. Please ask for a new code.');
  if (hashCode(phone, String(code).trim()) !== row.code_hash) {
    db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?').run(phone);
    throw fail('That code is not right. Please check and try again.');
  }
  db.prepare('DELETE FROM otps WHERE phone = ?').run(phone);

  const guest = req.user;
  const account = getUserByPhone(phone);
  let finalId;
  if (account && account.id !== guest.id) {
    if (!guest.phone) mergeUsers(guest.id, account.id); // bring this device's guest progress along
    finalId = account.id;
  } else {
    db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, guest.id);
    finalId = guest.id;
  }
  setUserCookie(res, finalId);
  logEvent(finalId, 'login', { returning: !!account });
  return getUser(finalId);
}

export function logout(res) {
  res.append('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${config.cookieSecure ? '; Secure' : ''}`);
}

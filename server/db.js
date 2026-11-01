import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(process.env.DB_PATH || path.join(config.dataDir, 'app.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  name TEXT,
  job_role TEXT,
  goals TEXT,
  facts TEXT NOT NULL DEFAULT '[]',
  plan TEXT NOT NULL DEFAULT 'trial',      -- trial | paid
  plan_until TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS otps (
  phone TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  user_turns INTEGER NOT NULL DEFAULT 0,
  seconds_spoken REAL NOT NULL DEFAULT 0,
  summary TEXT,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, started_at);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,          -- partner | learner
  text TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);

CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'grammar', -- grammar | word
  label TEXT NOT NULL,
  wrong TEXT NOT NULL,
  corrected TEXT NOT NULL,
  explanation_ml TEXT NOT NULL,
  times_made INTEGER NOT NULL DEFAULT 1,
  times_spoken_right INTEGER NOT NULL DEFAULT 0,
  mastered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_made_at TEXT NOT NULL,
  last_practiced_at TEXT,
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS practice_days (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  seconds REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  session_id TEXT,
  type TEXT NOT NULL,
  data TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, created_at);
`);

// ─── Additive migrations (safe to run on every start) ───────
function addColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addColumn('users', 'daily_goal_min', 'INTEGER NOT NULL DEFAULT 5');
addColumn('users', 'reminders', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'onboarded', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'ref_code', 'TEXT');
addColumn('users', 'referred_by', 'TEXT');
addColumn('users', 'referral_rewarded', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'bonus_sessions', 'INTEGER NOT NULL DEFAULT 0');
db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ref ON users(ref_code);
CREATE TABLE IF NOT EXISTS nudges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'app',
  day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_nudges_user ON nudges(user_id, id);
`);

export const now = () => new Date().toISOString();
export const newId = (prefix = '') => prefix + crypto.randomBytes(12).toString('base64url');

/** Calendar day (YYYY-MM-DD) in India time — streaks follow the learner's local day. */
export function dayOf(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function prevDay(day) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function logEvent(userId, type, data = null, sessionId = null) {
  db.prepare('INSERT INTO events (user_id, session_id, type, data, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userId ?? null,
    sessionId ?? null,
    type,
    data ? JSON.stringify(data) : null,
    now(),
  );
}

// ─── Users ───────────────────────────────────────────────────
export function createUser() {
  const id = newId('u_');
  db.prepare('INSERT INTO users (id, created_at, last_seen_at) VALUES (?, ?, ?)').run(id, now(), now());
  return getUser(id);
}

export function getUser(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null;
}

export function getUserByPhone(phone) {
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) ?? null;
}

export function touchUser(id) {
  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), id);
}

export function updateProfile(id, { name, job_role, goals, facts }) {
  const u = getUser(id);
  if (!u) return null;
  const clean = (v, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  let mergedFacts = safeJson(u.facts, []);
  if (Array.isArray(facts)) {
    for (const f of facts) {
      const t = clean(f, 160);
      if (t && !mergedFacts.some((x) => x.toLowerCase() === t.toLowerCase())) mergedFacts.push(t);
    }
    mergedFacts = mergedFacts.slice(-12);
  }
  db.prepare('UPDATE users SET name = ?, job_role = ?, goals = ?, facts = ? WHERE id = ?').run(
    clean(name, 60) ?? u.name,
    clean(job_role) ?? u.job_role,
    clean(goals, 200) ?? u.goals,
    JSON.stringify(mergedFacts),
    id,
  );
  return getUser(id);
}

/** Move everything a guest did into an existing (phone-verified) account, then delete the guest. */
export function mergeUsers(fromId, intoId) {
  if (fromId === intoId) return;
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE sessions SET user_id = ? WHERE user_id = ?').run(intoId, fromId);
    db.prepare('UPDATE events SET user_id = ? WHERE user_id = ?').run(intoId, fromId);
    for (const m of db.prepare('SELECT * FROM mistakes WHERE user_id = ?').all(fromId)) {
      const existing = db.prepare('SELECT id FROM mistakes WHERE user_id = ? AND key = ?').get(intoId, m.key);
      if (existing) {
        db.prepare(
          'UPDATE mistakes SET times_made = times_made + ?, times_spoken_right = times_spoken_right + ?, last_made_at = MAX(last_made_at, ?) WHERE id = ?',
        ).run(m.times_made, m.times_spoken_right, m.last_made_at, existing.id);
      } else {
        db.prepare('UPDATE mistakes SET user_id = ? WHERE id = ?').run(intoId, m.id);
      }
    }
    for (const d of db.prepare('SELECT * FROM practice_days WHERE user_id = ?').all(fromId)) {
      db.prepare(
        'INSERT INTO practice_days (user_id, day, seconds) VALUES (?, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET seconds = seconds + excluded.seconds',
      ).run(intoId, d.day, d.seconds);
    }
    const from = getUser(fromId);
    const into = getUser(intoId);
    db.prepare('UPDATE users SET name = COALESCE(name, ?), job_role = COALESCE(job_role, ?), goals = COALESCE(goals, ?), referred_by = COALESCE(referred_by, ?) WHERE id = ?').run(
      from?.name ?? null,
      from?.job_role ?? null,
      from?.goals ?? null,
      from?.referred_by && from.referred_by !== intoId ? from.referred_by : null,
      intoId,
    );
    db.prepare('UPDATE nudges SET user_id = ? WHERE user_id = ?').run(intoId, fromId);
    if (from && into) {
      const facts = [...safeJson(into.facts, []), ...safeJson(from.facts, [])].slice(-12);
      db.prepare('UPDATE users SET facts = ? WHERE id = ?').run(JSON.stringify(facts), intoId);
    }
    db.prepare('DELETE FROM mistakes WHERE user_id = ?').run(fromId);
    db.prepare('DELETE FROM practice_days WHERE user_id = ?').run(fromId);
    db.prepare('DELETE FROM users WHERE id = ?').run(fromId);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ─── Practice time & streaks ─────────────────────────────────
export function addPracticeSeconds(userId, seconds) {
  const s = Math.max(0, Math.min(Number(seconds) || 0, 300));
  db.prepare(
    'INSERT INTO practice_days (user_id, day, seconds) VALUES (?, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET seconds = seconds + excluded.seconds',
  ).run(userId, dayOf(), s);
  return s;
}

export function getStats(userId) {
  const days = db.prepare('SELECT day, seconds FROM practice_days WHERE user_id = ? ORDER BY day DESC').all(userId);
  const daySet = new Set(days.map((d) => d.day));
  const today = dayOf();
  // A streak stays alive if you practised today OR yesterday (so it doesn't look broken first thing in the morning).
  let cursor = daySet.has(today) ? today : prevDay(today);
  let streak = 0;
  while (daySet.has(cursor)) {
    streak++;
    cursor = prevDay(cursor);
  }
  const totalSeconds = days.reduce((a, d) => a + d.seconds, 0);
  const m = db
    .prepare('SELECT COUNT(*) AS total, SUM(mastered) AS mastered FROM mistakes WHERE user_id = ?')
    .get(userId);
  const sessionsDone = db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND done = 1').get(userId).n;
  // last 7 days for the little week strip
  const week = [];
  let d = today;
  for (let i = 0; i < 7; i++) {
    week.unshift({ day: d, practiced: daySet.has(d) });
    d = prevDay(d);
  }
  return {
    streak,
    practicedToday: daySet.has(today),
    daysPracticed: days.length,
    minutesSpoken: Math.round((totalSeconds / 60) * 10) / 10,
    mistakesTotal: m.total || 0,
    mistakesMastered: m.mastered || 0,
    sessionsDone,
    week,
    secondsToday: days.find((d) => d.day === today)?.seconds || 0,
  };
}

// ─── Mistake bank ────────────────────────────────────────────
export function recordMistake(userId, { key, kind, label, wrong, corrected, explanation_ml }) {
  const k = String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9_:\-]+/g, '_')
    .slice(0, 80) || 'general';
  const existing = db.prepare('SELECT * FROM mistakes WHERE user_id = ? AND key = ?').get(userId, k);
  if (existing) {
    // Made it again → refresh the example with the newest one and un-master it.
    db.prepare(
      `UPDATE mistakes SET times_made = times_made + 1, wrong = ?, corrected = ?, explanation_ml = ?, label = ?,
        mastered = 0, last_made_at = ? WHERE id = ?`,
    ).run(wrong, corrected, explanation_ml, label, now(), existing.id);
    return { ...db.prepare('SELECT * FROM mistakes WHERE id = ?').get(existing.id), repeated: true };
  }
  const r = db
    .prepare(
      `INSERT INTO mistakes (user_id, key, kind, label, wrong, corrected, explanation_ml, created_at, last_made_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, k, kind || 'grammar', label, wrong, corrected, explanation_ml, now(), now());
  return { ...db.prepare('SELECT * FROM mistakes WHERE id = ?').get(r.lastInsertRowid), repeated: false };
}

export const MASTERY_TARGET = 3;

export function markSpokenRight(userId, mistakeId) {
  const m = db.prepare('SELECT * FROM mistakes WHERE id = ? AND user_id = ?').get(mistakeId, userId);
  if (!m) return null;
  const right = m.times_spoken_right + 1;
  const mastered = right >= MASTERY_TARGET ? 1 : 0;
  db.prepare('UPDATE mistakes SET times_spoken_right = ?, mastered = ?, last_practiced_at = ? WHERE id = ?').run(
    right,
    mastered,
    now(),
    m.id,
  );
  return { ...m, times_spoken_right: right, mastered, justMastered: mastered && !m.mastered };
}

export function listMistakes(userId) {
  return db
    .prepare('SELECT * FROM mistakes WHERE user_id = ? ORDER BY mastered ASC, times_made DESC, last_made_at DESC')
    .all(userId);
}

export function topMistakeLabels(userId, n = 5) {
  return db
    .prepare('SELECT label, times_made FROM mistakes WHERE user_id = ? AND mastered = 0 ORDER BY times_made DESC, last_made_at DESC LIMIT ?')
    .all(userId, n);
}

/** Warm-up: due when there are ≥2 unmastered mistakes and no warm-up in the last 2 days. */
export function warmupStatus(userId) {
  const pending = db.prepare('SELECT COUNT(*) AS n FROM mistakes WHERE user_id = ? AND mastered = 0').get(userId).n;
  const last = db
    .prepare("SELECT created_at FROM events WHERE user_id = ? AND type = 'warmup_done' ORDER BY id DESC LIMIT 1")
    .get(userId);
  const sinceMs = last ? Date.now() - Date.parse(last.created_at) : Infinity;
  return { pending, due: pending >= 2 && sinceMs > 2 * 24 * 3600 * 1000 };
}

export function warmupItems(userId, n = 4) {
  return db
    .prepare(
      `SELECT * FROM mistakes WHERE user_id = ? AND mastered = 0
       ORDER BY COALESCE(last_practiced_at, '0') ASC, times_made DESC LIMIT ?`,
    )
    .all(userId, n);
}

// ─── Sessions ────────────────────────────────────────────────
export function createSession(userId, scenarioId) {
  const id = newId('s_');
  db.prepare('INSERT INTO sessions (id, user_id, scenario_id, started_at) VALUES (?, ?, ?, ?)').run(id, userId, scenarioId, now());
  return getSession(id);
}

export function getSession(id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) ?? null;
}

export function addMessage(sessionId, role, text, meta = null) {
  db.prepare('INSERT INTO messages (session_id, role, text, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(
    sessionId,
    role,
    text,
    meta ? JSON.stringify(meta) : null,
    now(),
  );
}

export function getMessages(sessionId) {
  return db.prepare('SELECT role, text, meta FROM messages WHERE session_id = ? ORDER BY id').all(sessionId);
}

export function recentSummaries(userId, n = 3) {
  return db
    .prepare('SELECT scenario_id, summary, ended_at FROM sessions WHERE user_id = ? AND summary IS NOT NULL ORDER BY ended_at DESC LIMIT ?')
    .all(userId, n);
}

/** Sessions started today (India time) and total completed. Used for the allowance. */
export function sessionCounts(userId) {
  const all = db.prepare('SELECT started_at, user_turns FROM sessions WHERE user_id = ?').all(userId);
  const today = dayOf();
  // Only count sessions where the learner actually spoke — opening a scenario and leaving is free.
  const real = all.filter((s) => s.user_turns > 0);
  return { total: real.length, today: real.filter((s) => dayOf(new Date(s.started_at)) === today).length };
}

export function safeJson(s, fallback) {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

// ─── Settings, referrals, account ────────────────────────────
export function updateSettings(id, { dailyGoalMin, reminders, onboarded }) {
  const u = getUser(id);
  if (!u) return null;
  const goal = [5, 10, 15, 20].includes(Number(dailyGoalMin)) ? Number(dailyGoalMin) : u.daily_goal_min;
  const rem = reminders === undefined ? u.reminders : reminders ? 1 : 0;
  const onb = onboarded ? 1 : u.onboarded;
  db.prepare('UPDATE users SET daily_goal_min = ?, reminders = ?, onboarded = ? WHERE id = ?').run(goal, rem, onb, id);
  return getUser(id);
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function ensureRefCode(id) {
  const u = getUser(id);
  if (u.ref_code) return u.ref_code;
  for (let i = 0; i < 10; i++) {
    const code = Array.from(crypto.randomBytes(6), (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
    try {
      db.prepare('UPDATE users SET ref_code = ? WHERE id = ?').run(code, id);
      return code;
    } catch {}
  }
  throw new Error('Could not create invite code');
}

/** Remember who invited this learner (only once, never yourself). */
export function attachReferral(userId, code) {
  const u = getUser(userId);
  const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!u || u.referred_by || !clean) return false;
  const inviter = db.prepare('SELECT id FROM users WHERE ref_code = ?').get(clean);
  if (!inviter || inviter.id === userId) return false;
  db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(inviter.id, userId);
  return true;
}

/** When an invited learner verifies their phone, both get bonus sessions (once). */
export function rewardReferral(userId, bonus) {
  const u = getUser(userId);
  if (!u?.referred_by || u.referral_rewarded || !u.phone) return false;
  db.prepare('UPDATE users SET referral_rewarded = 1, bonus_sessions = bonus_sessions + ? WHERE id = ?').run(bonus, userId);
  db.prepare('UPDATE users SET bonus_sessions = bonus_sessions + ? WHERE id = ?').run(bonus, u.referred_by);
  logEvent(u.referred_by, 'referral_rewarded', { invited: userId, bonus });
  return true;
}

export function referralCount(userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND referral_rewarded = 1').get(userId).n;
}

export function deleteUser(id) {
  db.prepare('DELETE FROM events WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id); // cascades to sessions, messages, mistakes, days, nudges
}

export function secondsToday(userId) {
  return db.prepare('SELECT seconds FROM practice_days WHERE user_id = ? AND day = ?').get(userId, dayOf())?.seconds || 0;
}

// ─── Weekly insights (honest, behaviour-based — no "fluency %") ──
export function weeklyInsights(userId) {
  const since = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const rows = db
    .prepare(
      `SELECT m.text, m.meta, m.created_at FROM messages m JOIN sessions s ON s.id = m.session_id
       WHERE s.user_id = ? AND m.role = 'learner' AND m.created_at >= ?`,
    )
    .all(userId, since(14));
  const week = { replies: 0, words: 0, lifeline: 0, corrected: 0 };
  const prev = { replies: 0, words: 0, lifeline: 0, corrected: 0 };
  const cut = since(7);
  for (const r of rows) {
    const b = r.created_at >= cut ? week : prev;
    const meta = safeJson(r.meta, {});
    b.replies++;
    b.words += (r.text.match(/[A-Za-z']+/g) || []).length;
    b.lifeline += (meta.lifeline || []).length;
    if (meta.mistakeId) b.corrected++;
  }
  const avg = (b) => (b.replies ? Math.round((b.words / b.replies) * 10) / 10 : 0);
  const mastered = db
    .prepare('SELECT COUNT(*) AS n FROM mistakes WHERE user_id = ? AND mastered = 1 AND last_practiced_at >= ?')
    .get(userId, cut).n;
  const days = db.prepare('SELECT COUNT(*) AS n FROM practice_days WHERE user_id = ? AND day >= ?').get(userId, dayOf(new Date(Date.now() - 6 * 86400000))).n;
  return {
    replies: week.replies,
    wordsPerReply: avg(week),
    wordsPerReplyPrev: avg(prev),
    lifelineWords: week.lifeline,
    lifelineWordsPrev: prev.lifeline,
    cleanReplyRate: week.replies ? Math.round(((week.replies - week.corrected) / week.replies) * 100) : 0,
    masteredThisWeek: mastered,
    daysThisWeek: days,
  };
}

// ─── Nudges (proactive personal messages) ────────────────────
export function latestNudge(userId) {
  return db.prepare('SELECT id, text, created_at FROM nudges WHERE user_id = ? AND read_at IS NULL ORDER BY id DESC LIMIT 1').get(userId) ?? null;
}
export function markNudgeRead(userId, id) {
  db.prepare('UPDATE nudges SET read_at = ? WHERE id = ? AND user_id = ?').run(now(), id, userId);
}
export function addNudge(userId, text, channel) {
  db.prepare('INSERT INTO nudges (user_id, text, channel, day, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, text, channel, dayOf(), now());
}
export function nudgeCandidates() {
  const today = dayOf();
  return db
    .prepare(
      `SELECT u.* FROM users u
       WHERE u.phone IS NOT NULL AND u.reminders = 1
         AND NOT EXISTS (SELECT 1 FROM practice_days d WHERE d.user_id = u.id AND d.day = ?)
         AND NOT EXISTS (SELECT 1 FROM nudges n WHERE n.user_id = u.id AND n.day = ?)
         AND EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id AND s.done = 1)`,
    )
    .all(today, today);
}

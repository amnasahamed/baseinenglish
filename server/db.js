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
    db.prepare('UPDATE users SET name = COALESCE(name, ?), job_role = COALESCE(job_role, ?), goals = COALESCE(goals, ?) WHERE id = ?').run(
      from?.name ?? null,
      from?.job_role ?? null,
      from?.goals ?? null,
      intoId,
    );
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

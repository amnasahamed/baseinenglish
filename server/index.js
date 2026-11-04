import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { config } from './config.js';
import * as store from './db.js';
import { db, logEvent, safeJson } from './db.js';
import { identify, normalizePhone, requestOtp, verifyOtp, logout, isFixedCodeNumber } from './auth.js';
import { transcribe, speak } from './openai.js';
import { coachTurn, personalOpener, summarizeSession } from './coach.js';
import { compareSpoken } from './compare.js';
import { scenarioById, publicScenarios, units, questionBank, roleById, phraseLessons } from './scenarios.js';
import { startNudgeScheduler } from './nudges.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, extra });

// ─── Tiny per-user rate limit for AI-backed endpoints ───────
const hits = new Map();
function rateLimit(max = 30) {
  return (req, res, next) => {
    const key = `${req.user.id}|${req.route?.path || req.path}`;
    const nowMin = Math.floor(Date.now() / 60000);
    const h = hits.get(key);
    if (!h || h.min !== nowMin) hits.set(key, { min: nowMin, n: 1 });
    else if (++h.n > max) return next(httpError(429, 'Slow down a little — try again in a minute.'));
    next();
  };
}
setInterval(() => hits.clear(), 10 * 60_000).unref();

// ─── Allowance ───────────────────────────────────────────────
const GUEST_SESSIONS = 1;
function allowance(user) {
  const { total, today } = store.sessionCounts(user.id);
  const paid = user.plan === 'paid' && (!user.plan_until || user.plan_until > new Date().toISOString());
  if (!user.phone) {
    return total < GUEST_SESSIONS
      ? { canStart: true, plan: 'guest', remaining: GUEST_SESSIONS - total }
      : { canStart: false, reason: 'login', plan: 'guest' };
  }
  if (today >= config.dailySessionLimit) return { canStart: false, reason: 'daily_limit', plan: paid ? 'paid' : 'trial' };
  if (paid) return { canStart: true, plan: 'paid', remainingToday: config.dailySessionLimit - today };
  const trialLeft = GUEST_SESSIONS + config.freeTrialSessions + (user.bonus_sessions || 0) - total;
  return trialLeft > 0
    ? { canStart: true, plan: 'trial', remaining: trialLeft, remainingToday: config.dailySessionLimit - today }
    : { canStart: false, reason: 'trial_over', plan: 'trial' };
}

function publicUser(u) {
  return {
    id: u.id,
    isGuest: !u.phone,
    phone: u.phone ? u.phone.slice(0, 3) + '•••••' + u.phone.slice(-3) : null,
    name: u.name,
    jobRole: u.job_role,
    goals: u.goals,
    plan: u.plan,
    dailyGoalMin: u.daily_goal_min,
    targetRole: u.target_role,
    targetRoleLabel: roleById[u.target_role]?.label || null,
    experience: u.experience,
    interviewDate: u.interview_date,
    daysToInterview: store.daysUntil(u.interview_date),
    company: u.company,
    reminders: !!u.reminders,
    onboarded: !!u.onboarded,
  };
}

function publicMistake(m) {
  return {
    id: m.id,
    kind: m.kind,
    label: m.label,
    wrong: m.wrong,
    corrected: m.corrected,
    explanationMl: m.explanation_ml,
    timesMade: m.times_made,
    timesSpokenRight: m.times_spoken_right,
    mastered: !!m.mastered,
    target: store.MASTERY_TARGET,
    lastMadeAt: m.last_made_at,
  };
}

/** XP + level snapshot after an action, with any daily rewards that just unlocked. */
function rewards(userId, gained, extra = {}) {
  const daily = store.checkDailyRewards(userId);
  const u = store.getUser(userId);
  return { xp: gained + daily.xp, level: store.levelFor(u.xp), goalMet: daily.goalMet, milestone: daily.milestone, freezeEarned: daily.freezeEarned, ...extra };
}

const api = express.Router();
api.use(identify);

api.get('/me', (req, res) => {
  const u = store.getUser(req.user.id);
  res.json({
    user: publicUser(u),
    stats: store.getStats(u.id),
    warmup: store.warmupStatus(u.id),
    allowance: allowance(u),
    upgrade: { url: config.upgradeUrl, price: config.upgradePriceText },
    insights: u.phone || store.getStats(u.id).sessionsDone ? store.weeklyInsights(u.id) : null,
    nudge: store.latestNudge(u.id),
    level: store.levelFor(u.xp),
    xpToday: store.xpToday(u.id),
    freezes: u.freezes,
    quests: store.dailyQuests(u.id),
    nextHook: u.next_hook,
    readiness: store.readiness(u.id),
    lastScenario: db.prepare('SELECT scenario_id FROM sessions WHERE user_id = ? AND done = 1 ORDER BY started_at DESC LIMIT 1').get(u.id)?.scenario_id || null,
    mock: config.mockAi,
  });
});

api.post('/settings', (req, res) => {
  const { dailyGoalMin, reminders, onboarded } = req.body || {};
  const u = store.updateSettings(req.user.id, { dailyGoalMin, reminders, onboarded });
  if (reminders !== undefined) logEvent(u.id, reminders ? 'reminders_on' : 'reminders_off');
  res.json({ user: publicUser(u) });
});

// ─── Learning path ───────────────────────────────────────────
const NODE_XP = { chest: 30, trophy: 60, phrases: 15 };
function buildPath(userId) {
  const runs = store.nodeRuns(userId);
  let foundCurrent = false;
  return units.map((u) => ({
    id: u.id,
    n: u.n,
    title: u.title,
    ml: u.ml,
    color: u.color,
    nodes: u.nodes.map((nd) => {
      const r = runs[nd.id] || 0;
      let state = r > 0 ? 'done' : 'locked';
      if (!r && !foundCurrent) {
        state = 'current';
        foundCurrent = true;
      }
      const sc = scenarioById[nd.id];
      const base = { id: nd.id, type: nd.type, state, runs: r };
      if (nd.type === 'lesson') return { ...base, title: sc.title, subtitle: sc.subtitle, partner: sc.partnerLabel, xp: 15 };
      if (nd.type === 'phrases') return { ...base, title: phraseLessons[nd.id].title, subtitle: 'Learn 5 useful sentences — listen and say them', xp: NODE_XP.phrases };
      if (nd.type === 'review') return { ...base, title: 'Fix your mistakes', subtitle: 'A 2-minute warm-up on your own mistakes', xp: 20 };
      return { ...base, title: nd.type === 'trophy' ? 'Unit trophy' : 'Reward chest', subtitle: 'Open it to collect XP', xp: NODE_XP[nd.type] };
    }),
  }));
}

api.get('/path', (req, res) => {
  res.json({ units: buildPath(req.user.id) });
});

/** Finish a non-lesson node: open a chest/trophy, or a review when there are no mistakes to practise. */
api.post('/path/:node/complete', (req, res) => {
  const node = units.flatMap((u) => u.nodes).find((n) => n.id === req.params.node);
  if (!node || node.type === 'lesson') throw httpError(400, 'Not a reward or review node');
  const cur = buildPath(req.user.id).flatMap((u) => u.nodes).find((n) => n.id === node.id);
  if (cur.state === 'locked') throw httpError(409, 'Finish the earlier steps first');
  let gained = 0;
  if (cur.state === 'current') {
    store.completeNode(req.user.id, node.id);
    if (NODE_XP[node.type]) gained = store.awardXp(req.user.id, `node:${node.id}`, NODE_XP[node.type]);
  }
  res.json({ gained, units: buildPath(req.user.id), level: store.levelFor(store.getUser(req.user.id).xp) });
});

// ─── Interview prep: answer bank & question bank ─────────────
api.get('/answers', (req, res) => {
  res.json({
    answers: store.answerBank(req.user.id).map((a) => ({ id: a.id, area: a.area, question: a.question, answer: a.answer, polished: a.polished, rating: a.rating, rehearsed: a.rehearsed })),
    readiness: store.readiness(req.user.id),
  });
});

api.get('/phrases/:node', (req, res) => {
  const lesson = phraseLessons[req.params.node];
  if (!lesson) throw httpError(404, 'Lesson not found');
  res.json({ id: req.params.node, ...lesson });
});

/** Phrasebook: phrases from the lessons you've reached + phrases Base taught you in conversations. */
api.get('/phrasebook', (req, res) => {
  const runs = store.nodeRuns(req.user.id);
  const path = buildPath(req.user.id).flatMap((u) => u.nodes);
  const reached = path.filter((n) => n.type === 'phrases' && n.state !== 'locked').map((n) => n.id);
  res.json({
    lessons: reached.map((id) => ({ id, title: phraseLessons[id].title, done: !!runs[id], phrases: phraseLessons[id].phrases })),
    learned: store.listPhrases(req.user.id),
  });
});

api.get('/questions', (req, res) => {
  const u = store.getUser(req.user.id);
  res.json({ areas: questionBank(u.target_role), readiness: store.readiness(u.id) });
});

api.post('/quests/claim', (req, res) => {
  const gained = store.claimChest(req.user.id);
  if (gained) logEvent(req.user.id, 'chest_claimed');
  res.json({ gained, level: store.levelFor(store.getUser(req.user.id).xp), quests: store.dailyQuests(req.user.id) });
});

api.get('/badges', (req, res) => {
  const { badges, fresh } = store.badgeStatus(req.user.id);
  store.markBadgesSeen(req.user.id, fresh.map((b) => b.id));
  res.json({ badges, fresh, level: store.levelFor(store.getUser(req.user.id).xp), levels: store.LEVELS });
});

api.post('/nudges/:id/read', (req, res) => {
  store.markNudgeRead(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

// ─── Invites ─────────────────────────────────────────────────
api.get('/invite', (req, res) => {
  const code = store.ensureRefCode(req.user.id);
  const base = config.publicUrl || `${req.protocol}://${req.get('host')}`;
  res.json({ code, url: `${base}/?ref=${code}`, bonus: config.referralBonusSessions, joined: store.referralCount(req.user.id) });
});

api.post('/referral', (req, res) => {
  const ok = store.attachReferral(req.user.id, req.body?.code);
  if (ok) logEvent(req.user.id, 'referral_attached');
  res.json({ ok });
});

api.delete('/me', (req, res) => {
  store.deleteUser(req.user.id);
  logout(res);
  res.json({ ok: true });
});

api.get('/scenarios', (req, res) => res.json(publicScenarios()));

api.post('/profile', (req, res) => {
  const { name, jobRole, goals, targetRole, experience, interviewDate, company } = req.body || {};
  const u = store.updateProfile(req.user.id, {
    name,
    job_role: jobRole,
    goals,
    target_role: roleById[targetRole] ? targetRole : undefined,
    experience: ['fresher', 'junior', 'senior'].includes(experience) ? experience : undefined,
    interview_date: interviewDate,
    company,
  });
  res.json({ user: publicUser(u) });
});

// ─── Auth ────────────────────────────────────────────────────
api.post(
  '/auth/request-otp',
  rateLimit(6),
  wrap(async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    if (!phone) throw httpError(400, 'Please enter a valid mobile number.');
    await requestOtp(phone, req.body?.channel);
    logEvent(req.user.id, 'otp_requested');
    const provider = isFixedCodeNumber(phone) ? 'fixed' : config.messageProvider === 'console' ? 'console' : 'sent';
    res.json({ ok: true, phone, provider, ...(provider === 'fixed' && config.otpTestNumbers.includes('*') ? { pilotCode: config.otpTestCode } : {}) });
  }),
);

api.post(
  '/auth/verify',
  rateLimit(10),
  wrap(async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    if (!phone || !req.body?.code) throw httpError(400, 'Enter the code we sent you.');
    let u = verifyOtp(req, res, phone, req.body.code);
    if (store.rewardReferral(u.id, config.referralBonusSessions)) u = store.getUser(u.id);
    res.json({ user: publicUser(u), stats: store.getStats(u.id) });
  }),
);

api.post('/auth/logout', (req, res) => {
  logout(res);
  res.json({ ok: true });
});

// ─── Practice sessions ───────────────────────────────────────
api.post(
  '/sessions',
  rateLimit(10),
  wrap(async (req, res) => {
    const scenario = scenarioById[req.body?.scenarioId];
    if (!scenario) throw httpError(400, 'Unknown scenario');
    const u = store.getUser(req.user.id);
    const a = allowance(u);
    if (!a.canStart) throw httpError(402, 'Practice limit reached', { reason: a.reason });

    const session = store.createSession(u.id, scenario.id);
    const summaries = store.recentSummaries(u.id);
    let opener = scenario.opener;
    if (scenario.id === 'drill') {
      opener = String(req.body?.question || '').trim().slice(0, 200) || scenario.opener;
    } else if (u.name || u.target_role || summaries.length) {
      try {
        opener = await personalOpener({ scenario, user: u, summaries, topMistakes: store.topMistakeLabels(u.id, 3) });
      } catch (e) {
        console.error('[opener]', e.message);
      }
    }
    store.addMessage(session.id, 'partner', opener);
    logEvent(u.id, 'session_start', { scenario: scenario.id }, session.id);
    res.json({ session: { id: session.id, scenarioId: scenario.id, title: scenario.title, partnerLabel: scenario.partnerLabel, maxTurns: scenario.maxTurns }, opener });
  }),
);

function ownSession(req) {
  const s = store.getSession(req.params.id);
  if (!s || s.user_id !== req.user.id) throw httpError(404, 'Session not found');
  return s;
}

api.post(
  '/sessions/:id/turn',
  rateLimit(20),
  upload.single('audio'),
  wrap(async (req, res) => {
    const session = ownSession(req);
    if (session.done) throw httpError(409, 'This conversation has finished.');
    const scenario = scenarioById[session.scenario_id];
    const u = store.getUser(req.user.id);
    const seconds = Number(req.body?.durationSec) || 0;

    let transcript = '';
    if (req.file) transcript = await transcribe(req.file.buffer, req.file.mimetype);
    else transcript = String(req.body?.text || '').trim().slice(0, 600);
    if (!transcript || transcript.replace(/[^\p{L}]/gu, '').length < 2) {
      throw httpError(422, "I couldn't hear that clearly. Tap the mic and try once more — take your time.");
    }

    const turnNumber = session.user_turns + 1;
    const finalTurn = turnNumber >= scenario.maxTurns;
    const history = store.getMessages(session.id);
    const result = await coachTurn({
      scenario,
      user: u,
      summaries: store.recentSummaries(u.id),
      topMistakes: store.topMistakeLabels(u.id),
      history,
      transcript,
      turnNumber,
      finalTurn,
    });

    let correction = null;
    if (result.correction?.say_it_like_this) {
      const c = result.correction;
      const m = store.recordMistake(u.id, {
        key: c.mistake_key,
        kind: c.kind === 'word' ? 'word' : 'grammar',
        label: c.mistake_label,
        wrong: c.you_said || transcript,
        corrected: c.say_it_like_this,
        explanation_ml: c.explanation_ml,
      });
      correction = {
        mistakeId: m.id,
        youSaid: c.you_said || transcript,
        sayItLikeThis: c.say_it_like_this,
        explanationMl: c.explanation_ml,
        label: c.mistake_label,
        kind: c.kind,
        repeated: m.repeated,
        timesMade: m.times_made,
      };
    }
    const lifeline = (result.lifeline_words || []).filter((w) => w.said && w.english);
    if (lifeline.length) logEvent(u.id, 'lifeline_used', { words: lifeline.map((w) => w.english) }, session.id);
    if (result.learned?.length) store.updateProfile(u.id, { facts: result.learned });

    const done = finalTurn || !!result.conversation_complete;
    const question = [...history].reverse().find((m) => m.role === 'partner')?.text || '';
    const rating = [1, 2, 3].includes(result.rating) ? result.rating : 2;
    const area = scenario.area || (result.question_area && result.question_area !== 'other' ? result.question_area : null);
    const answerId = area ? store.saveAnswer(u.id, { area, question, answer: transcript, polished: result.natural_version, rating }) : null;
    if (result.phrase_en) store.savePhrase(u.id, result.phrase_en, result.phrase_ml, scenario.title);
    store.addMessage(session.id, 'learner', transcript, { mistakeId: correction?.mistakeId ?? null, lifeline, rating, area });
    store.addMessage(session.id, 'partner', result.reply);
    const counted = store.addPracticeSeconds(u.id, seconds);
    db.prepare('UPDATE sessions SET user_turns = ?, seconds_spoken = seconds_spoken + ? WHERE id = ?').run(turnNumber, counted, session.id);
    logEvent(u.id, 'turn', { n: turnNumber, corrected: !!correction, sec: counted }, session.id);
    const gained = store.awardXp(u.id, 'reply') + (correction ? 0 : store.awardXp(u.id, 'clean_reply')) + (rating === 3 ? store.awardXp(u.id, 'strong_answer') : 0);

    res.json({
      transcript,
      meaning: result.meaning,
      lifeline,
      correction,
      praise: result.praise,
      reply: result.reply,
      coaching: { area, rating, phrase: result.phrase_en, phraseMl: result.phrase_ml, natural: result.natural_version, answerId },
      done,
      turn: turnNumber,
      maxTurns: scenario.maxTurns,
      rewards: rewards(u.id, gained, { clean: !correction }),
    });
  }),
);

api.post(
  '/sessions/:id/end',
  rateLimit(10),
  wrap(async (req, res) => {
    const session = ownSession(req);
    const scenario = scenarioById[session.scenario_id];
    const u = store.getUser(req.user.id);
    const history = store.getMessages(session.id);
    const learnerMsgs = history.filter((m) => m.role === 'learner').map((m) => ({ ...m, meta: safeJson(m.meta, {}) }));
    const mistakeIds = [...new Set(learnerMsgs.map((m) => m.meta.mistakeId).filter(Boolean))];
    const mistakes = mistakeIds
      .map((id) => db.prepare('SELECT * FROM mistakes WHERE id = ? AND user_id = ?').get(id, u.id))
      .filter(Boolean);
    const words = learnerMsgs.flatMap((m) => m.meta.lifeline || []);

    let coachNote = null;
    let nextHook = null;
    if (learnerMsgs.length && !session.ended_at) {
      try {
        const s = await summarizeSession({ scenario, user: u, history, mistakes });
        store.updateProfile(u.id, { name: s.name, job_role: s.job_role, goals: s.goals, facts: s.facts });
        db.prepare('UPDATE sessions SET summary = ? WHERE id = ?').run(`${scenario.title}: ${s.summary}`, session.id);
        coachNote = s.coach_note_ml;
        nextHook = s.next_hook || null;
        store.setNextHook(u.id, nextHook);
      } catch (e) {
        console.error('[summary]', e.message);
      }
      logEvent(u.id, 'session_complete', { turns: learnerMsgs.length, scenario: scenario.id }, session.id);
      store.completeNode(u.id, scenario.id);
    }
    db.prepare('UPDATE sessions SET ended_at = COALESCE(ended_at, ?), done = ? WHERE id = ?').run(
      store.now(),
      learnerMsgs.length ? 1 : 0,
      session.id,
    );
    const fresh = store.getUser(u.id);
    const daily = store.checkDailyRewards(u.id);
    const sessionXp = db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM xp_log WHERE user_id = ? AND created_at >= ?').get(u.id, session.started_at).n;
    const lvlAfter = store.levelFor(store.getUser(u.id).xp);
    const lvlBefore = store.levelFor(Math.max(0, store.getUser(u.id).xp - sessionXp));
    const { fresh: newBadges } = store.badgeStatus(u.id);
    if (fresh.phone) store.markBadgesSeen(u.id, newBadges.map((b) => b.id));
    const sessionAnswers = learnerMsgs.map((m) => m.meta).filter((m) => m.area);
    const report = scenario.id === 'mock_full'
      ? Object.values(sessionAnswers.reduce((acc, m) => {
          (acc[m.area] ||= { area: m.area, ratings: [] }).ratings.push(m.rating);
          return acc;
        }, {})).map((x) => ({ area: x.area, rating: Math.max(...x.ratings) }))
      : null;
    res.json({
      coachNote,
      nextHook,
      readiness: store.readiness(u.id),
      report,
      avgRating: sessionAnswers.length ? Math.round((sessionAnswers.reduce((a, m) => a + (m.rating || 2), 0) / sessionAnswers.length) * 10) / 10 : null,
      xp: sessionXp,
      levelBefore: lvlBefore,
      level: lvlAfter,
      goalMet: daily.goalMet || store.getStats(u.id).secondsToday >= (fresh.daily_goal_min || 5) * 60,
      milestone: daily.milestone,
      newBadges,
      quests: store.dailyQuests(u.id),
      firstToday: db.prepare('SELECT started_at FROM sessions WHERE user_id = ? AND done = 1').all(u.id).filter((x) => store.dayOf(new Date(x.started_at)) === store.dayOf()).length === 1,
      secondsSpoken: store.getSession(session.id).seconds_spoken,
      turns: learnerMsgs.length,
      mistakes: mistakes.map(publicMistake),
      words,
      stats: store.getStats(u.id),
      needLogin: !fresh.phone && learnerMsgs.length > 0,
      user: publicUser(fresh),
    });
  }),
);

// ─── Spoken retry (used in conversation, Mistake Bank and warm-up) ──
api.post(
  '/retry',
  rateLimit(30),
  upload.single('audio'),
  wrap(async (req, res) => {
    const target = String(req.body?.target || '').slice(0, 300);
    const context = ['session', 'bank', 'warmup', 'answer', 'phrase'].includes(req.body?.context) ? req.body.context : 'session';
    const mistakeId = Number(req.body?.mistakeId) || null;
    if (!target) throw httpError(400, 'Missing target sentence');
    let transcript = '';
    if (req.file) transcript = await transcribe(req.file.buffer, req.file.mimetype, { mockExpected: target });
    else transcript = String(req.body?.text || '').slice(0, 300);
    if (!transcript.trim()) throw httpError(422, "I couldn't hear that. Tap the mic and say it once more.");

    const r = compareSpoken(transcript, target, { threshold: context === 'answer' ? 0.6 : undefined });
    if (r.pass && context === 'answer' && Number(req.body?.answerId)) store.markRehearsed(req.user.id, Number(req.body.answerId));
    let mastery = null;
    if (r.pass && mistakeId) {
      const m = store.markSpokenRight(req.user.id, mistakeId);
      if (m) mastery = { timesSpokenRight: m.times_spoken_right, mastered: !!m.mastered, justMastered: !!m.justMastered };
    }
    store.addPracticeSeconds(req.user.id, Number(req.body?.durationSec) || 0);
    logEvent(req.user.id, r.pass ? 'retry_pass' : 'retry_fail', { context, score: r.score, attempt: Number(req.body?.attempt) || 1 }, req.body?.sessionId || null);
    let gained = 0;
    if (r.pass && context === 'phrase') gained += store.awardXp(req.user.id, 'bank_pass', 3);
    else if (r.pass) {
      gained += store.awardXp(req.user.id, context === 'session' ? 'retry_pass' : 'bank_pass');
      if (mastery?.justMastered) gained += store.awardXp(req.user.id, 'mastered');
    }
    res.json({ transcript, ...r, mastery, rewards: rewards(req.user.id, gained) });
  }),
);

// ─── Mistake bank & warm-up ──────────────────────────────────
api.get('/mistakes', (req, res) => {
  res.json({ mistakes: store.listMistakes(req.user.id).map(publicMistake), stats: store.getStats(req.user.id) });
});

api.get('/warmup', (req, res) => {
  res.json({ items: store.warmupItems(req.user.id).map(publicMistake) });
});

api.post('/warmup/done', (req, res) => {
  logEvent(req.user.id, 'warmup_done', { passed: Number(req.body?.passed) || 0, total: Number(req.body?.total) || 0 });
  const reviewNode = units.flatMap((u) => u.nodes).find((n) => n.id === req.body?.node && n.type === 'review');
  if (reviewNode) store.completeNode(req.user.id, reviewNode.id);
  const gained = Number(req.body?.passed) ? store.awardXp(req.user.id, 'warmup_done', store.XP.warmup_done, { once: true }) : 0;
  res.json({ ok: true, stats: store.getStats(req.user.id), rewards: rewards(req.user.id, gained) });
});

// ─── Voice ───────────────────────────────────────────────────
api.post(
  '/tts',
  rateLimit(60),
  wrap(async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) throw httpError(400, 'No text');
    const audio = await speak(text, { slow: !!req.body?.slow });
    if (!audio) return res.status(204).end(); // mock mode → browser voice fallback
    res.set('Content-Type', 'audio/mpeg').set('Cache-Control', 'private, max-age=86400').send(audio);
  }),
);

// ─── Pilot feedback & light analytics ────────────────────────
const CLIENT_EVENTS = new Set(['correction_feedback', 'retry_skipped', 'replay_partner', 'replay_correction', 'login_prompt_shown', 'login_skipped', 'paywall_shown', 'upgrade_clicked', 'share_progress', 'invite_shared', 'handsfree_on', 'mic_primed', 'sound_off', 'stronger_opened']);
api.post('/events', (req, res) => {
  const type = String(req.body?.type || '');
  if (!CLIENT_EVENTS.has(type)) return res.status(400).json({ error: 'unknown event' });
  const data = req.body?.data && typeof req.body.data === 'object' ? req.body.data : null;
  logEvent(req.user.id, type, data, req.body?.sessionId || null);
  res.json({ ok: true });
});

app.use('/api', api);

app.get('/healthz', (req, res) => res.json({ ok: true }));

// Pilot dashboard numbers (no cookie needed).
app.get('/api/admin/stats', (req, res) => {
  if (!config.adminToken || req.query.token !== config.adminToken) return res.status(401).json({ error: 'unauthorized' });
  res.json(pilotStats());
});

function pilotStats() {
  const count = (sql, ...a) => db.prepare(sql).get(...a).n;
  const ev = (type) => count('SELECT COUNT(*) AS n FROM events WHERE type = ?', type);
  const users = db.prepare('SELECT id, phone, name, created_at FROM users WHERE phone IS NOT NULL').all();
  const dayN = (u, n) => {
    const start = new Date(u.created_at);
    const target = new Date(start.getTime() + n * 86400000);
    return !!db.prepare('SELECT 1 FROM practice_days WHERE user_id = ? AND day >= ?').get(u.id, store.dayOf(target));
  };
  const old = (n) => users.filter((u) => Date.now() - Date.parse(u.created_at) >= n * 86400000);
  const retention = (n) => {
    const eligible = old(n);
    return { eligible: eligible.length, returned: eligible.filter((u) => dayN(u, n)).length };
  };
  const feedback = db.prepare("SELECT data FROM events WHERE type = 'correction_feedback'").all().map((r) => safeJson(r.data, {}));
  return {
    guests: count('SELECT COUNT(*) AS n FROM users WHERE phone IS NULL'),
    signedUp: users.length,
    sessionsStarted: ev('session_start'),
    sessionsCompleted: ev('session_complete'),
    turns: ev('turn'),
    lifelineTurns: ev('lifeline_used'),
    retries: { pass: ev('retry_pass'), fail: ev('retry_fail'), skipped: ev('retry_skipped') },
    correctionFeedback: { helpful: feedback.filter((f) => f.helpful).length, notHelpful: feedback.filter((f) => f.helpful === false).length },
    warmupsDone: ev('warmup_done'),
    nudgesSent: ev('nudge_sent'),
    referralsRewarded: ev('referral_rewarded'),
    remindersOn: count('SELECT COUNT(*) AS n FROM users WHERE reminders = 1'),
    retentionDay3: retention(3),
    retentionDay7: retention(7),
    learners: users.map((u) => ({
      name: u.name,
      phone: u.phone,
      joined: u.created_at.slice(0, 10),
      ...(({ streak, daysPracticed, minutesSpoken, mistakesTotal, mistakesMastered, sessionsDone }) => ({
        streak,
        daysPracticed,
        minutesSpoken,
        mistakesTotal,
        mistakesMastered,
        sessionsDone,
      }))(store.getStats(u.id)),
    })),
  };
}

// ─── Static app ──────────────────────────────────────────────
const pub = path.join(__dirname, '..', 'public');
app.use(express.static(pub, { maxAge: '1h', index: 'index.html' }));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(pub, 'index.html')));

// ─── Errors ──────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const status = err.status && err.status < 600 ? err.status : err.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
  if (status >= 500) console.error('[error]', req.method, req.path, err);
  const friendly = status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message;
  res.status(status).json({ error: friendly, ...(err.extra || {}) });
});

export { app };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startNudgeScheduler();
  app.listen(config.port, () => {
    console.log(`Base in English running on http://localhost:${config.port}${config.mockAi ? '  (MOCK_AI mode – no OpenAI calls)' : ''}`);
  });
}

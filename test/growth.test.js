// Settings, referrals, insights and proactive nudges (MOCK_AI mode).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bie-g-'));
process.env.DATA_DIR = dir;
process.env.MOCK_AI = '1';
process.env.OTP_TEST_NUMBERS = '+919000000001,+919000000002,+919000000003';
process.env.OTP_TEST_CODE = '111111';
process.env.OTP_RESEND_SECONDS = '0';
process.env.FREE_TRIAL_SESSIONS = '2';
process.env.REFERRAL_BONUS_SESSIONS = '3';

let server, base;
const jar = { a: '', b: '' };
let who = 'a';
async function call(p, { method = 'GET', body, form } = {}) {
  const headers = { cookie: jar[who] };
  let payload;
  if (form) payload = form;
  else if (body) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(base + '/api' + p, { method, headers, body: payload });
  for (const c of res.headers.getSetCookie?.() || []) if (c.startsWith('bie_uid=')) jar[who] = c.split(';')[0];
  return { status: res.status, data: res.headers.get('content-type')?.includes('json') ? await res.json() : null };
}
const text = (t) => {
  const f = new FormData();
  f.append('text', t);
  return f;
};
async function practise() {
  const s = await call('/sessions', { method: 'POST', body: { scenarioId: 'intro_yourself' } });
  await call(`/sessions/${s.data.session.id}/turn`, { method: 'POST', form: text('We discussed about the new project in the meeting.') });
  await call(`/sessions/${s.data.session.id}/end`, { method: 'POST' });
}
async function login(phone) {
  await call('/auth/request-otp', { method: 'POST', body: { phone } });
  return call('/auth/verify', { method: 'POST', body: { phone, code: '111111' } });
}

before(async () => {
  const { app } = await import('../server/index.js');
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('settings, insights, referral bonus and nudges', async () => {
  who = 'a';
  await practise();
  await login('+919000000001');
  const set = await call('/settings', { method: 'POST', body: { dailyGoalMin: 10, reminders: true, onboarded: true } });
  assert.equal(set.data.user.dailyGoalMin, 10);
  assert.equal(set.data.user.reminders, true);

  const me = await call('/me');
  assert.equal(me.data.insights.replies, 1);
  assert.ok(me.data.insights.wordsPerReply > 5);
  const trialBefore = me.data.allowance.remaining;
  assert.ok(me.data.level.xp >= 10, 'replies earn XP');
  assert.equal(me.data.quests.quests.length, 3);
  const badges = await call('/badges');
  assert.ok(badges.data.badges.find((b) => b.id === 'first_chat').earned);
  assert.equal((await call('/quests/claim', { method: 'POST' })).data.gained, 0, 'chest stays locked until all quests are done');

  const inv = await call('/invite');
  assert.match(inv.data.url, /\?ref=[A-Z0-9]{6}$/);

  // Friend opens the invite link on another phone
  who = 'b';
  await call('/me');
  const ref = await call('/referral', { method: 'POST', body: { code: inv.data.code } });
  assert.equal(ref.data.ok, true);
  await practise();
  await login('+919000000002');
  const friend = await call('/me');
  assert.equal(friend.data.allowance.remaining, 1 + 2 + 3 - 1, 'friend gets the bonus');

  who = 'a';
  const me2 = await call('/me');
  assert.equal(me2.data.allowance.remaining, trialBefore + 3, 'inviter gets the bonus');
  assert.equal((await call('/invite')).data.joined, 1);

  // Proactive nudge: A has reminders on, practised today → no nudge; pretend it is a new day.
  const store = await import('../server/db.js');
  store.db.prepare('DELETE FROM practice_days').run();
  const { runNudges } = await import('../server/nudges.js');
  const r = await runNudges({ dryRun: true });
  assert.equal(r.sent, 1, 'only the learner with reminders on gets a nudge');
  const me3 = await call('/me');
  assert.match(me3.data.nudge.text, /Base is ready/);
  await call(`/nudges/${me3.data.nudge.id}/read`, { method: 'POST' });
  assert.equal((await call('/me')).data.nudge, null);
  assert.equal((await runNudges({ dryRun: true })).sent, 0, 'one nudge per day');

  // Delete account
  who = 'b';
  assert.equal((await call('/me', { method: 'DELETE' })).data.ok, true);
});

test('learning path unlocks step by step', async () => {
  who = 'a';
  jar.a = '';
  const p0 = await call('/path');
  const flat = (r) => r.data.units.flatMap((u) => u.nodes);
  assert.equal(flat(p0)[0].type, 'phrases', 'every unit starts with a phrase lesson');
  assert.equal(flat(p0)[0].state, 'current');
  assert.equal(flat(p0)[1].state, 'locked');
  const lesson = await call('/phrases/u1_phrases');
  assert.equal(lesson.data.phrases.length, 5);
  assert.ok(lesson.data.phrases[0].ml);
  assert.equal((await call('/path/u1_phrases/complete', { method: 'POST' })).data.gained, 15);
  const s = await call('/sessions', { method: 'POST', body: { scenarioId: 'intro_yourself' } });
  await call(`/sessions/${s.data.session.id}/turn`, { method: 'POST', form: text('I have completed my BTech in 2021 from Kochi.') });
  const end = await call(`/sessions/${s.data.session.id}/end`, { method: 'POST' });
  assert.equal(end.data.firstToday, true);
  const p1 = flat(await call('/path'));
  assert.equal(p1[1].state, 'done');
  assert.equal(p1[2].state, 'current');
  const pb = await call('/phrasebook');
  assert.equal(pb.data.lessons[0].id, 'u1_phrases');
  assert.ok(pb.data.learned.length >= 1, 'phrases taught in conversation are saved');
  assert.equal((await call('/path/u1_chest/complete', { method: 'POST' })).status, 409, 'locked reward cannot be opened');
});

test('job English: job profile, English-first coaching, readiness, answer & question banks, drills', async () => {
  who = 'a';
  jar.a = '';
  const prof = await call('/profile', { method: 'POST', body: { targetRole: 'nursing', experience: 'fresher', interviewDate: '2099-01-10', company: 'Aster' } });
  assert.equal(prof.data.user.targetRoleLabel, 'Nursing / Healthcare');
  assert.ok(prof.data.user.daysToInterview > 0);

  const s = await call('/sessions', { method: 'POST', body: { scenarioId: 'intro_yourself' } });
  const t = await call(`/sessions/${s.data.session.id}/turn`, { method: 'POST', form: text('I have completed my BSc Nursing in 2023 from Kochi.') });
  assert.ok([1, 2, 3].includes(t.data.coaching.rating));
  assert.ok(t.data.coaching.phrase && t.data.coaching.phraseMl && t.data.coaching.natural);
  assert.equal(t.data.coaching.area, 'intro');

  const me = await call('/me');
  assert.ok(me.data.readiness.score > 0, 'readiness grows after an answer');
  assert.equal(me.data.readiness.areas.length, 5);

  const ans = await call('/answers');
  assert.equal(ans.data.answers.length, 1);
  const q = await call('/questions');
  assert.ok(q.data.areas.find((a) => a.id === 'work').questions.some((x) => /patient/i.test(x)), 'questions follow the chosen job');

  await call(`/sessions/${s.data.session.id}/end`, { method: 'POST' });
  await login('+919000000002');
  const d = await call('/sessions', { method: 'POST', body: { scenarioId: 'drill', question: 'What is your biggest weakness?' } });
  assert.equal(d.data.opener, 'What is your biggest weakness?');
  const dt = await call(`/sessions/${d.data.session.id}/turn`, { method: 'POST', form: text('I sometimes take too long to double check my work.') });
  assert.equal(dt.data.done, true, 'a drill is a single question');

  const top = (await call('/answers')).data.answers[0];
  const rehearse = new FormData();
  rehearse.append('text', top.polished);
  rehearse.append('target', top.polished);
  rehearse.append('context', 'answer');
  rehearse.append('answerId', String(top.id));
  assert.equal((await call('/retry', { method: 'POST', form: rehearse })).data.pass, true);
  assert.equal((await call('/answers')).data.answers.find((a) => a.id === top.id).rehearsed, 1);
});

test('career story: episodes, outcomes, daily unlock and the Base chat', async () => {
  who = 'b';
  jar.b = '';
  await call('/profile', { method: 'POST', body: { targetRole: 'nursing', company: 'Aster' } });
  const st0 = await call('/story');
  assert.equal(st0.data.current.id, 'intro_yourself');
  assert.equal(st0.data.company, 'Aster');
  assert.match(st0.data.current.setup, /Aster/);

  const ep = async (id) => {
    const s = await call('/sessions', { method: 'POST', body: { scenarioId: id } });
    assert.equal(s.status, 200, JSON.stringify(s.data));
    await call(`/sessions/${s.data.session.id}/turn`, { method: 'POST', form: text('I have completed my BSc Nursing in 2023 from Kochi.') });
    return call(`/sessions/${s.data.session.id}/end`, { method: 'POST' });
  };
  const e1 = await ep('intro_yourself');
  assert.equal(e1.data.story.outcome.kind, 'whatsapp');
  assert.equal(e1.data.story.next.id, 'background');
  await login('+919000000003');
  await ep('background');

  const st = await call('/story');
  assert.equal(st.data.current.id, 'work_studies');
  assert.equal(st.data.current.state, 'tomorrow', 'only two new episodes per day');
  const blocked = await call('/sessions', { method: 'POST', body: { scenarioId: 'work_studies' } });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.reason, 'tomorrow');
  assert.equal((await call('/sessions', { method: 'POST', body: { scenarioId: 'intro_yourself' } })).status, 200, 'replays are unlimited');

  const chat = await call('/chat');
  assert.ok(chat.data.messages[0].text.length > 5, 'Base opens the chat');
  const t = await call(`/sessions/${chat.data.session.id}/turn`, { method: 'POST', form: text('I am fine. Yesterday I discussed about my CV with my friend.') });
  assert.equal(t.data.done, false, 'the chat never ends by itself');
  assert.ok(t.data.correction);
  const again = await call('/chat');
  assert.equal(again.data.session.id, chat.data.session.id, 'one chat thread per day');
  assert.equal(again.data.messages.length, 3);
});

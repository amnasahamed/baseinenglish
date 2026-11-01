// Settings, referrals, insights and proactive nudges (MOCK_AI mode).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bie-g-'));
process.env.DATA_DIR = dir;
process.env.MOCK_AI = '1';
process.env.OTP_TEST_NUMBERS = '+919000000001,+919000000002';
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
  const s = await call('/sessions', { method: 'POST', body: { scenarioId: 'office_update' } });
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

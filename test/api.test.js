// End-to-end API flow in MOCK_AI mode (no OpenAI calls).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bie-'));
process.env.DATA_DIR = dir;
process.env.MOCK_AI = '1';
process.env.OTP_TEST_NUMBERS = '+919999999999';
process.env.OTP_TEST_CODE = '123456';
process.env.FREE_TRIAL_SESSIONS = '2';
process.env.ADMIN_TOKEN = 'admin';
process.env.OTP_RESEND_SECONDS = '0';

let server, base;
let cookie = '';
async function call(p, { method = 'GET', body, form } = {}) {
  const headers = { cookie };
  let payload;
  if (form) payload = form;
  else if (body) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(base + '/api' + p, { method, headers, body: payload });
  const set = res.headers.getSetCookie?.() || [];
  for (const c of set) if (c.startsWith('bie_uid=')) cookie = c.split(';')[0];
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { status: res.status, data };
}
const text = (t, extra = {}) => {
  const f = new FormData();
  f.append('text', t);
  for (const [k, v] of Object.entries(extra)) f.append(k, String(v));
  return f;
};

before(async () => {
  const { app } = await import('../server/index.js');
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('guest → conversation → correction → retry → summary → login → mistake bank', async () => {
  const me = await call('/me');
  assert.equal(me.data.user.isGuest, true);
  assert.equal(me.data.allowance.canStart, true);

  const s = await call('/sessions', { method: 'POST', body: { scenarioId: 'interview_intro' } });
  assert.equal(s.status, 200);
  assert.ok(s.data.opener.length > 10);
  const sid = s.data.session.id;

  const t1 = await call(`/sessions/${sid}/turn`, { method: 'POST', form: text('I am working in TCS since two years as a tester.') });
  assert.equal(t1.status, 200);
  assert.ok(t1.data.correction, 'expected a correction');
  assert.equal(t1.data.correction.sayItLikeThis, 'I have been working at TCS for two years as a tester.');

  const bad = await call('/retry', { method: 'POST', form: text('I am working in TCS since two years', { target: t1.data.correction.sayItLikeThis, mistakeId: t1.data.correction.mistakeId }) });
  assert.equal(bad.data.pass, false);
  const good = await call('/retry', { method: 'POST', form: text('I have been working at TCS for two years as a tester', { target: t1.data.correction.sayItLikeThis, mistakeId: t1.data.correction.mistakeId }) });
  assert.equal(good.data.pass, true);
  assert.equal(good.data.mastery.timesSpokenRight, 1);

  const t2 = await call(`/sessions/${sid}/turn`, { method: 'POST', form: text('Yesterday I missed the ആ അവസരം because I was late.') });
  assert.equal(t2.data.lifeline[0].english, 'opportunity');

  const end = await call(`/sessions/${sid}/end`, { method: 'POST' });
  assert.equal(end.data.needLogin, true);
  assert.equal(end.data.mistakes.length, 2);
  assert.ok(end.data.coachNote);

  // Guest can't start a 2nd session without logging in
  const blocked = await call('/sessions', { method: 'POST', body: { scenarioId: 'office_update' } });
  assert.equal(blocked.status, 402);
  assert.equal(blocked.data.reason, 'login');

  const otp = await call('/auth/request-otp', { method: 'POST', body: { phone: '9999999999' } });
  assert.equal(otp.status, 200, JSON.stringify(otp.data));
  assert.equal(otp.data.phone, '+919999999999');
  const wrong = await call('/auth/verify', { method: 'POST', body: { phone: '+919999999999', code: '000000' } });
  assert.equal(wrong.status, 400);
  const ok = await call('/auth/verify', { method: 'POST', body: { phone: '+919999999999', code: '123456' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.isGuest, false);

  const bank = await call('/mistakes');
  assert.equal(bank.data.mistakes.length, 2, 'guest mistakes carried over after login');

  const me2 = await call('/me');
  assert.equal(me2.data.allowance.canStart, true);
  assert.equal(me2.data.stats.sessionsDone, 1);
  assert.equal(me2.data.stats.streak, 1);
  assert.equal(me2.data.user.jobRole, 'software tester', 'profile learned from conversation');

  const warm = await call('/warmup');
  assert.equal(warm.data.items.length, 2);

  // A returning learner gets a personalised opener
  const s2 = await call('/sessions', { method: 'POST', body: { scenarioId: 'office_update' } });
  assert.match(s2.data.opener, /Welcome back/);

  const stats = await fetch(base + '/api/admin/stats?token=admin').then((r) => r.json());
  assert.equal(stats.signedUp, 1);
  assert.equal(stats.retries.pass, 1);
  assert.equal(stats.retries.fail, 1);
  assert.equal(stats.lifelineTurns, 1);
});

test('logging in on a new device merges the guest into the existing account', async () => {
  cookie = '';
  const s = await call('/sessions', { method: 'POST', body: { scenarioId: 'daily_cafe' } });
  await call(`/sessions/${s.data.session.id}/turn`, { method: 'POST', form: text('We discussed about the new project in the meeting.') });
  await call('/auth/request-otp', { method: 'POST', body: { phone: '+919999999999' } });
  const ok = await call('/auth/verify', { method: 'POST', body: { phone: '+919999999999', code: '123456' } });
  assert.equal(ok.status, 200);
  const bank = await call('/mistakes');
  assert.equal(bank.data.mistakes.length, 3);
  const me = await call('/me');
  assert.equal(me.data.user.jobRole, 'software tester');
});

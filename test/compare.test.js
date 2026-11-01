import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareSpoken, normalize } from '../server/compare.js';

test('normalize expands contractions and numbers', () => {
  assert.deepEqual(normalize("I've worked 2 years."), ['i', 'have', 'worked', 'two', 'years']);
});

test('exact and near-exact sentences pass', () => {
  const t = 'We discussed the new project in the meeting.';
  assert.equal(compareSpoken('we discussed the new project in the meeting', t).pass, true);
  assert.equal(compareSpoken('Uh, we discussed the new project in meeting.', t).pass, true);
});

test('repeating the old habit fails and names missing words', () => {
  const r = compareSpoken('I am working here since two years', 'I have been working here for two years.');
  assert.equal(r.pass, false);
  assert.ok(r.missing.includes('for'));
});

test('rambling that happens to include the words does not pass', () => {
  const t = 'I missed the opportunity.';
  const long = 'so yesterday what happened is I missed the opportunity because the bus was late and then my manager was angry and I went home';
  assert.equal(compareSpoken(long, t).pass, false);
});

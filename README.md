# Base in English

A low-pressure daily English speaking partner for Malayalam speakers. Learners speak at their own pace, use Malayalam words when they get stuck (the "Manglish lifeline"), get **one** clear fix explained in simple Malayalam, and must **say the corrected sentence out loud** before moving on.

## Quick start

```bash
npm install
cp .env.example .env      # then put your OpenAI key in OPENAI_API_KEY and set SESSION_SECRET
npm start                 # http://localhost:3000
```

Requires **Node 22.13+**. The database uses the built-in `node:sqlite`, so there are no native modules to compile. Data is stored in `./data/` (SQLite DB + cached TTS audio).

- `npm run mock` runs the UI without OpenAI, using canned replies. Use it for clicking through screens.
- `npm test` runs the comparison unit tests and an end-to-end API test in mock mode.

> Microphone access needs **HTTPS** (or `localhost`). For phones on a pilot, deploy behind HTTPS and set `COOKIE_SECURE=1`.

## OpenAI setup (all configurable in `.env`)

| Purpose | Default | Notes |
|---|---|---|
| Speech → text | `gpt-4o-transcribe` | Prompted to transcribe *verbatim*, keep grammar mistakes, and write Malayalam words in Malayalam script. If it "cleans up" learners' grammar too much, try `whisper-1`. |
| Partner + corrector | `gpt-4.1-mini` | Uses JSON-schema structured outputs. For a reasoning model like `gpt-5-mini`, also set `OPENAI_REASONING_EFFORT=minimal`. |
| Partner voice | `gpt-4o-mini-tts`, voice `coral` | Warm, slightly slow coaching voice. Audio is cached on disk, so repeated openers are free. If TTS fails, the browser's voice is used instead. |

All the teaching logic (persona, the "one fix" rules, the list of common Malayalam-speaker habits, the Malayalam explanation style, memory) lives in **`server/coach.js`**. The six scenarios live in **`server/scenarios.js`**. Edit these two files to tune the experience.

## How it works

- **Guest-first:** a signed cookie creates a guest instantly, with no signup wall. After the first conversation, the summary asks the learner to log in by phone/WhatsApp OTP to save their Mistake Bank and unlock the free trial. If the number already has an account, the guest's progress is merged into it.
- **The loop** (`POST /api/sessions/:id/turn`): audio → transcript → coach JSON (meaning, lifeline words, one correction, reply). The mistake is upserted into the Mistake Bank by a stable `mistake_key`, so repeats are counted. The UI then requires a spoken retry (`POST /api/retry`), checked by a lenient word-order match in `server/compare.js`. It does not grade accent. After 2 failed tries the learner can move on.
- **Mistake Bank:** a mistake is mastered after it has been said correctly 3 times. If the learner makes it again later, it goes back to unmastered.
- **Warm-up:** offered on the home screen when there are ≥2 unmastered mistakes and no warm-up in the last 2 days.
- **Memory:** at the end of each session the partner writes a short summary and updates the learner's profile (name, job, goals, facts). The next session's opener and replies use these.
- **Progress:** streak (India time), days practised, minutes spoken out loud, and old mistakes fixed. No fluency scores.
- **Allowance:** 1 guest session, then `FREE_TRIAL_SESSIONS` after login, with `DAILY_SESSION_LIMIT` per day. To give someone the paid pass, run `UPDATE users SET plan='paid', plan_until='2027-01-01' WHERE phone='+91…';` in `data/app.db`. The upgrade button links to `UPGRADE_URL`.

## Login / OTP

- `OTP_PROVIDER=console` (default) prints codes in the server log. This is fine for local testing or for hand-holding a small pilot.
- `OTP_PROVIDER=twilio_whatsapp` or `twilio_sms` sends codes via Twilio. Fill in `TWILIO_*`.
- `OTP_TEST_NUMBERS` + `OTP_TEST_CODE` set a fixed code for specific test phones.

## Pilot dashboard

Set `ADMIN_TOKEN`, then open `/api/admin/stats?token=…`. It shows: sign-ups, sessions, how many turns used the Malayalam lifeline, retry pass/fail/skip counts, 👍/👎 on whether corrections made sense, warm-ups, Day-3 / Day-7 return rates, and per-learner stats. These map directly onto the four pilot questions.

## Project layout

```
server/
  index.js      Express app + all API routes
  coach.js      prompts, JSON schemas, memory (the "teaching brain")
  scenarios.js  the 6 Day-1 scenarios
  openai.js     STT / chat / TTS via fetch (+ mock mode)
  compare.js    lenient "did they say the corrected sentence?" check
  auth.js       guest cookie, phone OTP, Twilio
  db.js         SQLite schema + queries (streaks, mistake bank, sessions)
public/         mobile-first SPA, no build step (index.html, app.js, styles.css)
test/           node:test suites
```

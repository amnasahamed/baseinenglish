# Base — English for your job

**A spoken-English teaching app for Malayalam speakers who want a (better) job.** The goal is English; the job journey is the context. Learners pick the kind of job they want (IT, nursing, BPO, sales, accounts, teaching, jobs abroad…), and every lesson uses situations and vocabulary from that world.

The path follows the job journey, one unit at a time:
1. **Introduce yourself:** name, studies, work, hometown.
2. **Talk about your work:** daily tasks, past work, a project.
3. **Phone & HR calls:** the HR screening call; calling to reschedule or follow up.
4. **English for interviews:** strengths, why this job, questions about your field, plus a full mock interview.
5. **English at your new job:** team updates, asking for leave or explaining a delay, talking to customers.

Every unit starts with a **phrase lesson**: 5 useful sentences with the Malayalam meaning and a short note. The learner listens and says each one out loud. Then come **speaking lessons**, where Base plays HR, a colleague, a manager, an interviewer or a customer.

After every answer the learner gets:
- An **English rating**: understandable / clear / natural & professional. It covers their English, not their accent.
- **One English fix** (if needed), explained in Malayalam, which they say out loud before continuing.
- **One useful phrase** to learn, saved to their **Phrasebook**.
- **How to say it naturally:** their own answer in natural English, saved to **My best answers** for rehearsal.
- Malayalam words are allowed when stuck; the English word is taught.

Progress is a **Job-ready English** score across 5 situations: introducing yourself, talking about work, phone & HR calls, interview answers, and English at work.

## Quick start

```bash
npm install
cp .env.example .env      # then put your OpenAI key in OPENAI_API_KEY and set SESSION_SECRET
npm start                 # http://localhost:3000
```

Requires **Node 22.13+**. The database uses the built-in `node:sqlite`, so there are no native modules to compile. Data is stored in `./data/` (SQLite DB + cached TTS audio).

- `npm run mock` runs the UI without OpenAI, using canned replies. Use it for clicking through screens.
- `npm test` runs the comparison unit tests and end-to-end API tests in mock mode.
- `npm run nudges` sends today's personal check-in messages (add `-- --dry-run` to only create the in-app cards).

> Microphone access needs **HTTPS** (or `localhost`). For phones on a pilot, deploy behind HTTPS and set `COOKIE_SECURE=1`.

## Deploy

**Render (recommended, about 10 minutes):** push this repo to GitHub, then in Render choose **New → Blueprint** and pick the repo. `render.yaml` sets up a Docker web service in Singapore with a 1 GB persistent disk for the database, a generated `SESSION_SECRET` and `ADMIN_TOKEN`, HTTPS, and daily check-ins at 7pm IST. Paste your `OPENAI_API_KEY` when asked, then set `PUBLIC_URL` to the address Render gives you.

**Any Docker host** (Railway, Fly.io, a VPS):

```bash
docker build -t base-in-english .
```
```bash
docker run -p 3000:3000 -v base-data:/data --env-file .env base-in-english
```

Always mount a volume at `/data`: it holds the SQLite database and the voice cache. Put HTTPS in front (the microphone needs it) and set `COOKIE_SECURE=1`. The health check is `GET /healthz`.

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

## Login, reminders & messaging

- `MESSAGE_PROVIDER=console` (default) prints codes and reminders in the server log. This is fine for local testing or for hand-holding a small pilot.
- `twilio_whatsapp` or `twilio_sms` sends via Twilio. Fill in `TWILIO_*`.
- `webhook` POSTs `{to, text, kind}` to `MESSAGE_WEBHOOK_URL`. Use this for Zoho CPaaS or any Indian WhatsApp provider.
- `OTP_TEST_NUMBERS` + `OTP_TEST_CODE` set a fixed code for specific test phones. With `OTP_TEST_NUMBERS=*`, **every** number logs in with that code and the code screen says so. `render.yaml` ships with `*` and `000000` for the pilot. Remove both once WhatsApp is connected, because until then anyone who knows a number can open that account.

**Proactive check-ins:** learners who turn on reminders (onboarding or Settings) get one short, personal message on days they haven't practised. The message is written from Base's memory of them, e.g. "How did your interview go?". Set `NUDGE_HOUR` to send these automatically, or run `npm run nudges` from a cron job. The message also appears in the app as a card from Base. Note: WhatsApp business-initiated messages usually need an approved template with your provider.

## Growth & retention features

- **Daily goal** (5/10/15 min) with a progress ring on the home screen, plus a 7-day streak strip.
- **Weekly speaking insights** instead of a fluency score: words per reply (vs last week), replies with no fix needed, Malayalam words used (fewer over time means a growing vocabulary), and old mistakes mastered.
- **Invite a friend:** each learner gets a link (`/?ref=CODE`). When the friend verifies their phone, both get `REFERRAL_BONUS_SESSIONS` free sessions.
- **Share my progress:** generates a branded 1080×1350 image for WhatsApp status or Instagram stories, with the learner's invite link.
- **Settings:** daily goal, reminders, profile, plan, help, privacy policy, terms and the 10-day refund promise, log out, and delete account and data. Fill in the `[COMPANY NAME]` / `[CONTACT]` placeholders in `public/app.js` (`renderLegal`) before launch.

## App structure (v3)

The app is built around the same ideas as the best language apps, with our own look and content:

- **Welcome:** the mascot (Base, a little green friend with a coconut-leaf sprout) says hi. One button starts the first lesson; there's no signup.
- **Learn tab (the path):** the 5 units above. Each starts with a phrase lesson (listen → meaning in Malayalam → say it), then speaking lessons, a review of your own mistakes and a reward. Unit 4 ends with a full mock interview.
- **Lesson:** one exchange per screen. The mascot asks (and talks, thinks or cheers), you answer with the big 3D mic, and feedback slides up from the bottom: green "Nice!" or gold "Almost! Say it like this" with the Malayalam explanation and a **Say it out loud** button. You continue only after that. A progress bar sits on top, with a combo flame and hands-free mode.
- **Lesson complete:** XP, speaking time and no-fix replies count up, the level bar fills, and badges pop in. Next comes the streak screen (first lesson of the day), then saving progress (guests) or tomorrow's teaser plus daily quests.
- **Practice tab:** full mock interview, **Speaking practice** (answer any single question, by situation), **Phrasebook**, **My best answers**, mistake warm-up, Mistake Bank, and replaying any conversation.
- **Progress tab:** Job-ready English by situation (and the countdown if an interview date is set), level (Starter → Clear Speaker → Call Ready → Interview Ready → Office Ready → … → Fluent Professional), streak and daily goal, quests, and weekly insights.
- **Profile tab:** plan, daily goal, reminders, sounds, about you, help and legal.

## Habit loop (why people come back)

Borrowed from the best habit apps, tuned to be encouraging rather than guilt-driven:

| Mechanic | What the learner sees |
|---|---|
| **XP & 10 levels** | +10 per reply, +5 with no fix needed, +10 for saying a fix aloud, +25 for mastering a mistake, +30 for the daily goal, +50 for the quest chest. Levels go from *First Words* to *Natural Speaker* (with Malayalam names). |
| **Combos** | "3 in a row — on fire!" for consecutive clean replies or first-try fixes. |
| **Daily quests + chest** | Speak for your goal, say 3 fixes aloud, fix 1 old mistake. Finish all 3 to open a chest worth bonus XP. |
| **Streaks with freezes** | One freeze is saved automatically and protects a single missed day. Earn another every 7-day milestone (max 2). An evening reminder appears only when a streak is at risk. |
| **Reward reel** | At the end of a session, XP counts up, the level bar fills, and the goal, milestone and new badges pop in with sound and vibration. |
| **Tomorrow hook** | Base ends each session with a personal teaser ("Tomorrow: tell me how the client call went") and offers a WhatsApp reminder. The next session opens with that follow-up. |
| **Badges** | 12 achievements, plus a level ladder showing the road ahead (`#/badges`). |
| **Sound & haptics** | Small synthesized sounds and vibrations. They can be switched off in Settings. |

Guardrails: no fake urgency or countdowns, no streak shaming, the daily session limit still applies, and the paywall never interrupts a conversation.

## UX details

- **Try first, sign in later:** no signup wall. The login prompt comes right after the first win.
- **Permission priming:** before the browser's microphone prompt, the app explains in English and Malayalam why it needs the mic and that recordings aren't kept.
- **Hands-free mode** (headset button in a conversation): Base listens automatically after speaking and sends when the learner pauses for about 2 seconds, like a phone call. Tap-to-talk stays the default for nervous beginners.
- **Instant feedback:** the learner's bubble appears immediately with a live waveform while their speech is transcribed.
- **One fix at a time**, which must be said aloud, with the option to move on after 2 tries.
- **Accessibility:** 44px+ touch targets, visible focus rings, screen-reader labels on icon buttons, live-region hints, and focus moves to each new screen's heading. Reduced-motion settings are respected.
- **Installable:** works as an app from the home screen. A service worker serves the app shell offline (over HTTPS).

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
  auth.js       guest cookie, phone OTP
  messaging.js  WhatsApp/SMS sending (console, Twilio, webhook)
  nudges.js     daily personal check-in messages
  db.js         SQLite schema + queries (streaks, mistake bank, sessions)
public/         mobile-first SPA, no build step (index.html, app.js, styles.css)
test/           node:test suites
```

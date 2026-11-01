// Proactive, personal check-in messages ("How did your interview go?").
// Run once a day: `npm run nudges`, or set NUDGE_HOUR (India time, 0–23) to let the server do it.
// Note: business-initiated WhatsApp messages need an approved template with most providers;
// the in-app card always works.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from './config.js';
import * as store from './db.js';
import { nudgeMessage } from './coach.js';
import { sendMessage } from './messaging.js';

export async function runNudges({ dryRun = false } = {}) {
  const users = store.nudgeCandidates();
  let sent = 0;
  for (const u of users) {
    try {
      const stats = store.getStats(u.id);
      const text = await nudgeMessage({
        user: u,
        summaries: store.recentSummaries(u.id, 2),
        topMistakes: store.topMistakeLabels(u.id, 2),
        streak: stats.streak,
      });
      const link = config.publicUrl ? `\n${config.publicUrl}/` : '';
      let channel = 'app';
      if (!dryRun) channel = await sendMessage(u.phone, text + link, { kind: 'nudge' }).catch(() => 'app');
      store.addNudge(u.id, text, channel);
      store.logEvent(u.id, 'nudge_sent', { channel });
      sent++;
    } catch (e) {
      console.error('[nudges]', u.id, e.message);
    }
  }
  return { candidates: users.length, sent };
}

let lastRunDay = null;
export function startNudgeScheduler() {
  if (config.nudgeHour === null) return;
  const tick = async () => {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: config.timeZone }).format(new Date()));
    const today = store.dayOf();
    if (hour === config.nudgeHour && lastRunDay !== today) {
      lastRunDay = today;
      const r = await runNudges();
      console.log(`[nudges] ${r.sent}/${r.candidates} sent`);
    }
  };
  setInterval(tick, 5 * 60_000).unref();
  tick();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runNudges({ dryRun: process.argv.includes('--dry-run') }).then((r) => {
    console.log(`Nudges: ${r.sent} sent of ${r.candidates} candidates`);
    process.exit(0);
  });
}

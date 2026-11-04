// The career story: the learner is the main character of their own job hunt.
// Each episode is a real moment (a job fair, an HR call, an interview round, the first week)
// played as a speaking lesson. Finishing an episode moves the story forward.
import { scenarioById, roleById } from './scenarios.js';
import { dayOf } from './db.js';

// Realistic but fictional employers, so the story works even without a target company.
const DEFAULT_COMPANY = {
  it: 'Nexa Technologies', nursing: 'Lakeshore Hospital', support: 'BrightCall Services', sales: 'Zentro Retail',
  accounts: 'Ledgerline Finance', teaching: 'Greenfield Public School', abroad: 'Gulfway Facilities, Dubai', other: 'Horizon Group',
};
const ROLE_TITLE = {
  it: 'software engineer', nursing: 'staff nurse', support: 'customer support executive', sales: 'sales executive',
  accounts: 'accounts assistant', teaching: 'teacher', abroad: 'operations assistant', other: 'trainee',
};

// Career track shown at the top of the story.
export const STAGES = ['Applied', 'Shortlisted', 'HR call', 'Interview', 'Offer', 'First week'];

export const chapters = [
  {
    n: 1, title: 'The job hunt begins', ml: 'ജോലി തേടൽ തുടങ്ങുന്നു',
    episodes: [
      {
        id: 'intro_yourself', headline: 'You made a great first impression!', title: 'The job fair', stage: 0, mode: 'talk', prep: 'u1_phrases',
        setup: 'You walk into a job fair in Kochi. A friendly recruiter from {company} waves you over.',
        outcome: { kind: 'whatsapp', from: 'Recruiter · {company}', text: 'Hi {name}, lovely meeting you at the fair! I have passed your CV to our HR team.' },
        teaser: 'Will {company} call you?',
      },
      {
        id: 'background', headline: 'You have an insider on your side!', title: 'Coffee with an insider', stage: 0, mode: 'talk',
        setup: 'A friend of a friend works at {company}. Over a coffee, she wants to know more about you.',
        outcome: { kind: 'whatsapp', from: 'Divya · works at {company}', text: 'So nice talking to you! I put in a good word. Keep your phone close…' },
        teaser: 'Your phone might ring soon.',
      },
    ],
  },
  {
    n: 2, title: 'Getting the call', ml: 'ആ ഫോൺ കോൾ',
    episodes: [
      {
        id: 'work_studies', headline: 'You are shortlisted!', title: 'Your CV, out loud', stage: 1, mode: 'talk', prep: 'u2_phrases',
        setup: '{company} shortlisted your CV! A team lead wants a quick chat about what you do.',
        outcome: { kind: 'mail', from: '{company} HR', subject: 'You are shortlisted', text: 'Dear {name}, our HR team will call you tomorrow to discuss the {roleTitle} role.' },
        teaser: 'Tomorrow: the HR call.',
      },
      {
        id: 'hr_call', headline: 'You got the interview!', title: 'The HR call', stage: 2, mode: 'call', prep: 'u3_phrases', caller: 'Priya', callerRole: 'HR · {company}',
        setup: 'Priya from {company} HR is calling about your application. Answer like a professional.',
        outcome: { kind: 'mail', from: '{company} HR', subject: 'Interview invitation', text: 'Dear {name}, we are happy to invite you for an interview on Monday at 10:30 AM.' },
        teaser: 'Uh-oh — Monday clashes with something.',
      },
      {
        id: 'followup_call', headline: 'Interview rescheduled!', title: 'A change of plan', stage: 2, mode: 'call', caller: 'Reception', callerRole: '{company}',
        setup: 'Monday clashes with your exam. Call {company} HR and politely ask to reschedule.',
        outcome: { kind: 'mail', from: '{company} HR', subject: 'Interview rescheduled', text: 'No problem, {name}. Your interview is now on Wednesday at 11 AM. See you then!' },
        teaser: 'Wednesday, 11 AM: the interview room.',
      },
    ],
  },
  {
    n: 3, title: 'The interview', ml: 'ഇന്റർവ്യൂ',
    episodes: [
      {
        id: 'experience_star', headline: 'Round 1 cleared!', title: 'Round 1 · Your experience', stage: 3, mode: 'talk',
        setup: 'Wednesday, 11 AM. You are in the interview room at {company}. The hiring manager smiles: "Tell me about your work."',
        outcome: { kind: 'note', from: 'Hiring manager', text: '"Good examples. Please wait outside — the HR round is next."' },
        teaser: 'Next: the HR round.',
      },
      {
        id: 'strengths', headline: 'HR round cleared!', title: 'Round 2 · The HR round', stage: 3, mode: 'talk', prep: 'u4_phrases',
        setup: 'The HR manager at {company} wants to know who you are — your strengths and weaknesses.',
        outcome: { kind: 'note', from: 'HR manager', text: '"Thank you. The team lead would like to meet you too."' },
        teaser: 'Next: questions about your field.',
      },
      {
        id: 'role_questions', headline: 'Into the final round!', title: 'Round 3 · The team lead', stage: 3, mode: 'talk',
        setup: 'The team lead you would work with asks about your field. Explain clearly and calmly.',
        outcome: { kind: 'mail', from: '{company} HR', subject: 'Final round', text: 'Dear {name}, you have cleared the first rounds. Please join us for a short final conversation tomorrow.' },
        teaser: 'Tomorrow: the final round.',
      },
      {
        id: 'why_hire', headline: 'The director is impressed!', title: 'The final question', stage: 3, mode: 'talk',
        setup: 'The director of {company} has one big question for you: why should we hire you?',
        outcome: { kind: 'note', from: 'Director', text: '"Thank you, {name}. We will let you know very soon."' },
        teaser: 'The panel wants one last full interview…',
      },
      {
        id: 'mock_full', headline: 'You got the offer!', title: 'The full panel', stage: 3, mode: 'talk', milestone: 'offer',
        setup: 'One last step: a full interview with the {company} panel. Put everything you learned together.',
        outcome: { kind: 'mail', from: '{company} HR', subject: 'Offer letter', text: 'Dear {name}, we are pleased to offer you the role of {roleTitle}. Your clear communication stood out.' },
        teaser: 'Chapter 4: your first week at work.',
      },
    ],
  },
  {
    n: 4, title: 'Your first week', ml: 'പുതിയ ജോലിയിലെ ആദ്യ ആഴ്ച',
    episodes: [
      {
        id: 'office_update', headline: 'Great first standup!', title: 'Day 1 · The morning standup', stage: 5, mode: 'talk', prep: 'u5_phrases',
        setup: 'Your first morning at {company}! The team lead asks everyone for a quick update. Your turn.',
        outcome: { kind: 'whatsapp', from: 'Team lead', text: 'Nice clear update today, {name}. Welcome to the team!' },
        teaser: 'Day 3: an unhappy customer is on the line.',
      },
      {
        id: 'customer_call', headline: 'The customer is happy!', title: 'Day 3 · An unhappy customer', stage: 5, mode: 'call', caller: 'Mr. Thomas', callerRole: 'Customer',
        setup: 'A customer is upset about a delay. Listen, apologise and solve it — calmly.',
        outcome: { kind: 'note', from: 'Mr. Thomas', text: '"Thank you for your help. You were very polite."' },
        teaser: 'Day 5: you need a day off.',
      },
      {
        id: 'office_leave', headline: 'Your first week — done!', title: 'Day 5 · Asking for leave', stage: 5, mode: 'talk', milestone: 'team',
        setup: 'You have a family function next Friday. Ask your manager for leave — and explain a small delay.',
        outcome: { kind: 'mail', from: 'Manager · {company}', subject: 'Leave approved', text: 'Approved, {name}. Great first week — happy to have you on the team.' },
        teaser: 'You did it. More chapters are coming soon.',
      },
    ],
  },
];

export const episodeById = Object.fromEntries(chapters.flatMap((c) => c.episodes.map((e) => [e.id, { ...e, chapter: c.n }])));
const ORDER = chapters.flatMap((c) => c.episodes.map((e) => e.id));

export function storyContext(user) {
  const role = roleById[user?.target_role] ? user.target_role : 'other';
  return {
    name: user?.name ? user.name.split(' ')[0] : 'you',
    company: user?.company || DEFAULT_COMPANY[role],
    roleTitle: ROLE_TITLE[role],
  };
}

export function fill(text, ctx) {
  return String(text || '')
    .replaceAll('{company}', ctx.company)
    .replaceAll('{roleTitle}', ctx.roleTitle)
    .replaceAll('{name}', ctx.name === 'you' ? 'there' : ctx.name);
}

/** A scenario adapted to the learner's story (company and role filled in). */
export function personalizeScenario(scenario, user) {
  const ctx = storyContext(user);
  const ep = episodeById[scenario.id];
  return {
    ...scenario,
    role: fill(scenario.role, ctx),
    opener: fill(scenario.opener, ctx),
    brief: fill(scenario.brief, ctx) + (ep ? `\nStory context: ${fill(ep.setup, ctx)} The company is ${ctx.company}; the job is ${ctx.roleTitle}.` : ''),
  };
}

function publicEpisode(e, ctx) {
  return {
    id: e.id,
    n: ORDER.indexOf(e.id) + 1,
    stage: e.stage,
    title: e.title,
    chapter: e.chapter,
    mode: e.mode,
    prep: e.prep || null,
    setup: fill(e.setup, ctx),
    teaser: fill(e.teaser, ctx),
    caller: e.caller || null,
    callerRole: e.callerRole ? fill(e.callerRole, ctx) : null,
    partner: scenarioById[e.id]?.partnerLabel || null,
  };
}

export function outcomeFor(id, user) {
  const e = episodeById[id];
  if (!e) return null;
  const ctx = storyContext(user);
  const nextId = ORDER[ORDER.indexOf(id) + 1];
  return {
    episode: publicEpisode(e, ctx),
    outcome: { ...e.outcome, from: fill(e.outcome.from, ctx), subject: e.outcome.subject ? fill(e.outcome.subject, ctx) : null, text: fill(e.outcome.text, ctx) },
    headline: fill(e.headline, ctx),
    milestone: e.milestone || null,
    next: nextId ? publicEpisode(episodeById[nextId], ctx) : null,
    company: ctx.company,
    roleTitle: ctx.roleTitle,
  };
}

/**
 * Story state. Episodes unlock in order; at most `perDay` NEW episodes can be finished per day
 * (replays and chatting with Base are unlimited).
 * @param runs {[episodeId]: {runs, completed_at}}
 */
export function buildStory(user, runs, perDay) {
  const ctx = storyContext(user);
  const today = dayOf();
  const newToday = ORDER.filter((id) => runs[id] && dayOf(new Date(runs[id].completed_at)) === today).length;
  let current = null;
  let stage = 0;
  const out = chapters.map((c) => ({
    n: c.n,
    title: c.title,
    ml: c.ml,
    episodes: c.episodes.map((e0) => {
      const e = { ...e0, chapter: c.n };
      const done = !!runs[e.id];
      let state = done ? 'done' : 'locked';
      if (!done && !current) {
        state = newToday >= perDay ? 'tomorrow' : 'current';
        current = { ...publicEpisode(e, ctx), state };
      }
      if (done) stage = Math.max(stage, e.stage + (e.milestone === 'offer' ? 1 : 0));
      return { ...publicEpisode(e, ctx), state, runs: runs[e.id]?.runs || 0 };
    }),
  }));
  if (!current) stage = STAGES.length - 1;
  else stage = Math.max(stage, episodeById[current.id].stage);
  const total = ORDER.length;
  const doneCount = ORDER.filter((id) => runs[id]).length;
  return { ...ctx, stages: STAGES, stage, chapters: out, current, doneCount, total, newToday, perDay, finished: !current };
}

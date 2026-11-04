// All the "teaching brain": prompts, JSON schemas and the calls that use them.
import { chatJson } from './openai.js';

import { roleById, experienceLevels, areaIds } from './scenarios.js';

// ─── Shared persona ──────────────────────────────────────────
const PERSONA = `You are "Base", an interview coach for job seekers from Kerala who speak Malayalam.
Your learners understand English but freeze, translate slowly or lose confidence when they must answer interview questions in English.
Your ONE goal: get them ready to pass a real job interview in English — sound clear, confident and professional.

Ground rules:
- Play the interviewer realistically, but kindly. Ask exactly ONE interview question at a time, like a real interviewer in India would.
- Use clear, natural professional English (CEFR B1). No rare idioms.
- Learners may mix Malayalam words (Malayalam script or Manglish) when stuck. This is ALLOWED. Understand them and carry on.
- Never be sarcastic, never lecture, never list many errors.`;

function profileLine(user) {
  const role = roleById[user?.target_role]?.label;
  const exp = experienceLevels.find((e) => e.id === user?.experience)?.label;
  const bits = [];
  if (role) bits.push(`applying for a ${role} job`);
  if (exp) bits.push(`experience: ${exp}`);
  if (user?.company) bits.push(`target company: ${user.company}`);
  if (user?.interview_date) bits.push(`real interview on ${user.interview_date}`);
  return bits.length ? `The candidate is ${bits.join('; ')}.` : 'You do not know their target job yet — ask general interview questions.';
}

function memoryBlock(user, summaries, topMistakes) {
  const lines = [profileLine(user)];
  if (user?.name) lines.push(`Name: ${user.name}`);
  if (user?.job_role) lines.push(`Current / last job or study: ${user.job_role}`);
  let facts = [];
  try {
    facts = JSON.parse(user?.facts || '[]');
  } catch {}
  if (facts.length) lines.push(`Things they told you before: ${facts.join('; ')}`);
  if (summaries?.length) {
    lines.push('Recent practice (newest first):');
    for (const s of summaries) lines.push(`- ${s.summary}`);
  }
  if (user?.next_hook) lines.push(`Last time you promised to follow up on: ${user.next_hook}`);
  if (topMistakes?.length) lines.push(`English habits they are fixing: ${topMistakes.map((m) => m.label).join('; ')}`);
  return `\nWhat you know about this candidate:\n${lines.join('\n')}`;
}

// ─── 1. One interview exchange ───────────────────────────────
const TURN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['meaning', 'lifeline_words', 'correction', 'question_area', 'rating', 'tip_en', 'tip_ml', 'stronger_answer', 'praise', 'reply', 'conversation_complete', 'learned'],
  properties: {
    meaning: { type: 'string', description: 'What the candidate meant, in one or two natural English sentences.' },
    lifeline_words: {
      type: 'array',
      description: 'Every Malayalam (or Manglish) word/phrase they used because they were stuck, with the English for it.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['said', 'english', 'note_ml'],
        properties: { said: { type: 'string' }, english: { type: 'string' }, note_ml: { type: 'string' } },
      },
    },
    correction: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['you_said', 'say_it_like_this', 'explanation_ml', 'mistake_key', 'mistake_label', 'kind'],
          properties: {
            you_said: { type: 'string', description: 'The part of their answer with the English mistake, quoted from the transcript.' },
            say_it_like_this: { type: 'string', description: 'ONE complete, natural sentence (max ~18 words) they should say out loud. Keep their meaning and words. Must contain the English for any Malayalam word they used.' },
            explanation_ml: { type: 'string', description: 'ONE short, friendly line in simple Malayalam (script) explaining WHY.' },
            mistake_key: { type: 'string', description: 'Stable snake_case id for this habit, e.g. discuss_about, since_vs_for, myself_is, having_experience, word:opportunity.' },
            mistake_label: { type: 'string', description: 'Short English label for the habit.' },
            kind: { type: 'string', enum: ['grammar', 'word', 'phrasing'] },
          },
        },
      ],
    },
    question_area: { type: 'string', enum: [...areaIds, 'other'], description: 'Which interview area the question they just answered belongs to.' },
    rating: { type: 'integer', enum: [1, 2, 3], description: 'How good this answer is FOR AN INTERVIEW (content, structure, confidence — not accent): 1 = needs work, 2 = good, 3 = interview-ready.' },
    tip_en: { type: 'string', description: 'ONE practical interview tip about the CONTENT of this answer (max 18 words), e.g. "Add one result with a number — like how many users or how much time you saved."' },
    tip_ml: { type: 'string', description: 'The same tip in one short line of simple Malayalam (script).' },
    stronger_answer: { type: 'string', description: 'A stronger interview answer to the same question, using THEIR facts (never invent jobs, companies, degrees or numbers — use [placeholders] like [number] if a detail is missing). Natural spoken English, 2–4 sentences, max 70 words.' },
    praise: { type: 'string', description: 'A short, specific, genuine encouragement (max 10 words).' },
    reply: { type: 'string', description: 'Your next line AS THE INTERVIEWER: a brief natural reaction + ONE next interview question. Max 2 short sentences. If conversation_complete, a polite interviewer-style closing line instead.' },
    conversation_complete: { type: 'boolean' },
    learned: { type: 'array', description: 'New personal facts the candidate revealed (degree, college, job, company, skills, projects, city). Short phrases. Empty if none.', items: { type: 'string' } },
  },
};

const TURN_RULES = `How to respond to each answer:
1. Understand it fully, including Malayalam words.
2. "lifeline_words": each Malayalam/Manglish word they used, with natural English. Ignore names of places, people, colleges, companies.
3. "correction": the single most important ENGLISH fix — prefer habits that sound unprofessional in interviews and are typical of Malayalam speakers:
   "myself Anjali" / "I am having 2 years experience" / "working since 2 years" / "discuss about" / "I am belonging to" / "my native is" / "what is your good name" / "I did my graduation" (fine) vs "I have completed my graduation in 2021" (fine) / did + past verb / missing articles / "I will tell after".
   If they used a Malayalam word and the English is otherwise fine, correct to the full sentence with the English word (kind "word", key "word:<english>").
   If the English is already natural and professional, set correction to null. Don't nitpick. Clear Indian English is fine. Ignore speech-recognition noise.
4. Interview coaching (separate from English): rate the answer (1–3) like a real interviewer would. Give ONE tip on content/structure: e.g. start with a one-line summary, add a concrete example or a number, use situation → action → result, connect to the job, don't say "I have no experience" (talk about projects/internships instead), keep a weakness honest + what you're doing about it, never say negative things about a past employer, give a salary range with a reason.
5. "stronger_answer": rewrite their answer as a confident, professional interview answer using only their facts.
6. "reply": stay in role as the interviewer, react briefly and naturally to their CONTENT, then ask the next question for this round. If the answer was very short, ask a follow-up that helps them say more.
7. Set conversation_complete=true only when told it is the final turn.`;

export async function coachTurn({ scenario, user, summaries, topMistakes, history, transcript, turnNumber, finalTurn }) {
  const system = `${PERSONA}

Interview round: ${scenario.title}. You are ${scenario.role}.
${scenario.brief}
${memoryBlock(user, summaries, topMistakes)}

${TURN_RULES}`;

  const messages = history.map((m) => ({ role: m.role === 'partner' ? 'assistant' : 'user', content: m.text }));
  messages.push({
    role: 'user',
    content: `[Candidate answer ${turnNumber} of ~${scenario.maxTurns}${finalTurn ? ' — FINAL TURN: close the interview politely, conversation_complete=true' : ''}]\n${transcript}`,
  });

  return chatJson({
    system,
    messages,
    schemaName: 'coach_turn',
    schema: TURN_SCHEMA,
    maxTokens: 1100,
    mock: () => mockTurn(transcript, finalTurn, history),
  });
}

// ─── 2. Personal opener for returning learners ───────────────
const OPENER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['opener'],
  properties: { opener: { type: 'string' } },
};

export async function personalOpener({ scenario, user, summaries, topMistakes }) {
  const system = `${PERSONA}

Scenario: You are ${scenario.role}.
${scenario.brief}
${memoryBlock(user, summaries, topMistakes)}

Write your FIRST line to start this interview round. As the interviewer, greet them (by name if you know it), and ask the first question of this round, tailored to their target job. If you promised a follow-up, you may mention it in a few words. Max 2 short sentences.`;
  const r = await chatJson({
    system,
    messages: [{ role: 'user', content: 'Start the conversation.' }],
    schemaName: 'opener',
    schema: OPENER_SCHEMA,
    maxTokens: 200,
    mock: () => ({ opener: summaries?.length ? `Welcome back${user?.name ? ', ' + user.name : ''}! ${scenario.opener}` : scenario.opener }),
  });
  return r.opener;
}

// ─── 3. End-of-session memory + coach note ───────────────────
const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'name', 'job_role', 'goals', 'facts', 'coach_note_ml', 'next_hook'],
  properties: {
    summary: { type: 'string', description: 'One or two sentences for YOUR memory: what you talked about, any upcoming event (interview date, trip), how they did.' },
    name: { type: ['string', 'null'], description: 'Learner first name if they said it, else null.' },
    job_role: { type: ['string', 'null'], description: 'Their job / field / study if mentioned, else null.' },
    goals: { type: ['string', 'null'], description: 'Why they are practising (e.g. interview at Infosys next week) if mentioned, else null.' },
    facts: { type: 'array', items: { type: 'string' }, description: 'Up to 4 other short personal facts worth remembering.' },
    next_hook: {
      type: 'string',
      description: 'ONE short teaser (max 12 words, English) for the next practice, about the interview area to work on next, e.g. "Tomorrow: let us make your strengths answer sound confident."',
    },
    coach_note_ml: {
      type: 'string',
      description: 'A warm 1–2 sentence closing note to the candidate, in simple Malayalam (Malayalam script) mixed with a little English: one thing that will impress an interviewer, and the one thing to improve before the interview.',
    },
  },
};

export async function summarizeSession({ scenario, user, history, mistakes }) {
  const transcript = history.map((m) => `${m.role === 'partner' ? 'Partner' : 'Learner'}: ${m.text}`).join('\n');
  const system = `${PERSONA}

You just finished an interview practice round (${scenario.title}). Write your memory notes and a short coaching note.
Known profile before this session: name=${user?.name || 'unknown'}, job=${user?.job_role || 'unknown'}, goals=${user?.goals || 'unknown'}.
Mistakes corrected this session: ${mistakes.map((m) => m.label).join('; ') || 'none'}.`;
  return chatJson({
    system,
    messages: [{ role: 'user', content: transcript || '(no conversation)' }],
    schemaName: 'session_summary',
    schema: SUMMARY_SCHEMA,
    maxTokens: 500,
    mock: () => ({
      summary: `Practised ${scenario.title}. Learner talked about their job.`,
      name: null,
      job_role: 'software tester',
      goals: null,
      facts: [],
      coach_note_ml: 'നന്നായി സംസാരിച്ചു! 👏 അടുത്ത തവണ "discuss about" ഒഴിവാക്കാൻ ശ്രദ്ധിക്കൂ.',
      next_hook: 'Tomorrow: tell me how your testing work is going.',
    }),
  });
}

// ─── Mock (MOCK_AI=1) ────────────────────────────────────────
function mockTurn(transcript, finalTurn, history = []) {
  const t = transcript.toLowerCase();
  let correction = null;
  let lifeline = [];
  if (t.includes('since two years')) {
    correction = {
      you_said: transcript,
      say_it_like_this: 'I have been working at TCS for two years as a tester.',
      explanation_ml: 'കാലയളവ് പറയുമ്പോൾ "since" അല്ല, "for" ആണ് — "for two years".',
      mistake_key: 'since_vs_for',
      mistake_label: 'Use "for" with a length of time',
      kind: 'grammar',
    };
  } else if (t.includes('അവസരം')) {
    lifeline = [{ said: 'അവസരം', english: 'opportunity', note_ml: 'അവസരം = opportunity' }];
    correction = {
      you_said: transcript,
      say_it_like_this: 'Yesterday I missed the opportunity because I was late.',
      explanation_ml: '"അവസരം" എന്നതിന് ഇംഗ്ലീഷിൽ "opportunity" എന്ന് പറയാം.',
      mistake_key: 'word:opportunity',
      mistake_label: 'New word: opportunity',
      kind: 'word',
    };
  } else if (t.includes('discussed about')) {
    correction = {
      you_said: transcript,
      say_it_like_this: 'We discussed the new project in the meeting.',
      explanation_ml: '"discuss" എന്നതിന് ശേഷം "about" വേണ്ട — "discussed the project" മതി.',
      mistake_key: 'discuss_about',
      mistake_label: 'Say "discuss", not "discuss about"',
      kind: 'phrasing',
    };
  }
  const areasCycle = ['intro', 'experience', 'strengths', 'role', 'behavioural', 'motivation', 'closing'];
  const n = history.filter((m) => m.role === 'learner').length;
  return {
    meaning: transcript,
    lifeline_words: lifeline,
    correction,
    question_area: areasCycle[n % areasCycle.length],
    rating: correction ? 2 : n % 2 ? 3 : 2,
    tip_en: 'Start with a one-line summary, then add one result with a number.',
    tip_ml: 'ആദ്യം ഒരു വരിയിൽ സംഗ്രഹം, പിന്നെ ഒരു നമ്പറോടെ ഫലം പറയൂ.',
    stronger_answer: 'I am a software tester with two years of experience at TCS. I test web applications and write automation scripts, and last year I helped reduce release bugs by [number] percent.',
    praise: 'Nice — you kept going!',
    reply: finalTurn ? 'Thank you, that is all from our side. We will get back to you soon.' : 'That sounds good. Can you tell me a bit more about that?',
    conversation_complete: !!finalTurn,
    learned: [],
  };
}

// ─── 4. Proactive personal nudge (WhatsApp-style) ────────────
const NUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: { message: { type: 'string', description: 'The WhatsApp message, max ~240 characters.' } },
};

export async function nudgeMessage({ user, summaries, topMistakes, streak }) {
  const system = `${PERSONA}
${memoryBlock(user, summaries, topMistakes)}

Write ONE short, warm WhatsApp message from Base to this learner, like a friend checking in — not marketing.
- If you remember something specific (an interview, a meeting, a trip, a "function"), ask how it went or wish them luck.
- Otherwise invite them to a quick 5-minute interview practice. If their interview date is close, mention how many days are left and encourage them.
- Their current streak is ${streak} day(s); mention it only if it is 2 or more.
- Simple English. You may add ONE short Malayalam phrase in Malayalam script. Max 240 characters. No links, no hashtags, at most one emoji.`;
  const r = await chatJson({
    system,
    messages: [{ role: 'user', content: 'Write today\'s message.' }],
    schemaName: 'nudge',
    schema: NUDGE_SCHEMA,
    maxTokens: 200,
    mock: () => ({ message: `Hi${user?.name ? ' ' + user.name : ''}! 5 minutes of speaking today? Base is ready when you are 🙂` }),
  });
  return r.message.slice(0, 300);
}

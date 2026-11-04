// All the "teaching brain": prompts, JSON schemas and the calls that use them.
import { chatJson } from './openai.js';

import { roleById, experienceLevels, areaIds } from './scenarios.js';

// ─── Shared persona ──────────────────────────────────────────
const PERSONA = `You are "Base", a warm, patient spoken-English teacher for Malayalam speakers from Kerala who want a job or a better job.
Your learners understand English but freeze, translate slowly or lose confidence when they must SPEAK it — in interviews, HR calls and at work.
Your goal is to TEACH SPOKEN ENGLISH: build their confidence, fix one English habit at a time, and give them natural, professional phrases they can reuse at work and in interviews.

Ground rules:
- Play the role in the practice situation (HR, colleague, manager, interviewer, customer) naturally and kindly. Ask exactly ONE question at a time.
- Use clear, natural professional English (CEFR A2–B1). Short sentences. No rare idioms.
- Learners may mix Malayalam words (Malayalam script or Manglish) when stuck. This is ENCOURAGED. Understand them and carry on.
- Never be sarcastic, never lecture, never list many errors.`;

function profileLine(user) {
  const role = roleById[user?.target_role]?.label;
  const exp = experienceLevels.find((e) => e.id === user?.experience)?.label;
  const bits = [];
  if (role) bits.push(`applying for a ${role} job`);
  if (exp) bits.push(`experience: ${exp}`);
  if (user?.company) bits.push(`target company: ${user.company}`);
  if (user?.interview_date) bits.push(`real interview on ${user.interview_date}`);
  return bits.length ? `The learner is ${bits.join('; ')}. Use situations and vocabulary from this kind of job.` : 'You do not know their target job yet — keep situations general.';
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
  return `\nWhat you know about this learner:\n${lines.join('\n')}`;
}

// ─── 1. One interview exchange ───────────────────────────────
const TURN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['meaning', 'lifeline_words', 'correction', 'question_area', 'rating', 'phrase_en', 'phrase_ml', 'natural_version', 'praise', 'reply', 'conversation_complete', 'learned'],
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
    question_area: { type: 'string', enum: [...areaIds, 'other'], description: 'Which speaking situation this answer belongs to: intro (introducing yourself), work (talking about work/studies), calls (phone & HR calls), interview (interview answers), workplace (English at work).' },
    rating: { type: 'integer', enum: [1, 2, 3], description: 'How their SPOKEN ENGLISH sounded in this answer (clarity, grammar, natural phrasing — not accent, not content): 1 = understandable but needs work, 2 = clear, 3 = natural & professional.' },
    phrase_en: { type: 'string', description: 'ONE useful, natural English phrase (3–10 words) they could have used in this answer and can reuse at work or in interviews, e.g. "I was responsible for …", "Could you please repeat that?", "I look forward to …". Pick something slightly above their level.' },
    phrase_ml: { type: 'string', description: 'What that phrase means / when to use it, in one short line of simple Malayalam (script).' },
    natural_version: { type: 'string', description: 'Their WHOLE answer said in natural, professional spoken English — same meaning and facts, nothing invented (use [placeholders] if a detail is missing). 1–4 short sentences, max 60 words.' },
    praise: { type: 'string', description: 'A short, specific, genuine encouragement (max 10 words).' },
    reply: { type: 'string', description: 'Your next line AS THE INTERVIEWER: a brief natural reaction + ONE next interview question. Max 2 short sentences. If conversation_complete, a polite interviewer-style closing line instead.' },
    conversation_complete: { type: 'boolean' },
    learned: { type: 'array', description: 'New personal facts the candidate revealed (degree, college, job, company, skills, projects, city). Short phrases. Empty if none.', items: { type: 'string' } },
  },
};

const TURN_RULES = `How to respond to each answer:
1. Understand it fully, including Malayalam words.
2. "lifeline_words": each Malayalam/Manglish word they used, with natural English. Ignore names of places, people, colleges, companies.
3. "correction": the single most important English fix — prefer habits typical of Malayalam speakers that sound unprofessional at work:
   "myself Anjali" / "I am having 2 years experience" / "working since 2 years" / "discuss about" / "revert back" / "I am belonging to" / "my native is" / "I will tell after" / "today morning" / "what is your good name" / did + past verb / missing articles / wrong tense / question word order / plural-singular / prepositions.
   If they used a Malayalam word and the English is otherwise fine, correct to the full sentence with the English word (kind "word", key "word:<english>").
   If the English is already natural, set correction to null. Don't nitpick. Clear Indian English is fine. Ignore speech-recognition noise.
4. The explanation is ONE line of simple, kind Malayalam a 12th-standard student understands.
5. "rating" is about their English only. "phrase_en" teaches one reusable professional phrase. "natural_version" shows how a confident speaker would say the same thing.
6. "reply": stay in your role, react briefly to their CONTENT (not their grammar), then ask ONE next question. Use the English word for anything they said in Malayalam so they hear it.
7. Set conversation_complete=true only when told it is the final turn.`;

export async function coachTurn({ scenario, user, summaries, topMistakes, history, transcript, turnNumber, finalTurn }) {
  const system = `${PERSONA}

Speaking practice: ${scenario.title}. You are ${scenario.role}.
${scenario.brief}
${memoryBlock(user, summaries, topMistakes)}

${TURN_RULES}`;

  const messages = history.map((m) => ({ role: m.role === 'partner' ? 'assistant' : 'user', content: m.text }));
  messages.push({
    role: 'user',
    content: `[Learner answer ${turnNumber} of ~${scenario.maxTurns}${finalTurn ? ' — FINAL TURN: close the conversation warmly, conversation_complete=true' : ''}]\n${transcript}`,
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

Write your FIRST line to start this speaking practice. Stay in your role, greet them (by name if you know it), and ask the first question, tailored to their kind of job. If you promised a follow-up, you may mention it in a few words. Max 2 short sentences.`;
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
      description: 'ONE short teaser (max 12 words, English) for the next lesson, e.g. "Tomorrow: let us practise your HR phone call."',
    },
    coach_note_ml: {
      type: 'string',
      description: 'A warm 1–2 sentence closing note in simple Malayalam (Malayalam script) mixed with a little English: praise one thing about their English, and name the one habit to watch.',
    },
  },
};

export async function summarizeSession({ scenario, user, history, mistakes }) {
  const transcript = history.map((m) => `${m.role === 'partner' ? 'Partner' : 'Learner'}: ${m.text}`).join('\n');
  const system = `${PERSONA}

You just finished a speaking lesson (${scenario.title}). Write your memory notes and a short teaching note.
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
  const areasCycle = ['intro', 'work', 'calls', 'interview', 'workplace'];
  const n = history.filter((m) => m.role === 'learner').length;
  return {
    meaning: transcript,
    lifeline_words: lifeline,
    correction,
    question_area: areasCycle[n % areasCycle.length],
    rating: correction ? 2 : n % 2 ? 3 : 2,
    phrase_en: 'I was responsible for …',
    phrase_ml: 'ഒരു ജോലി നിങ്ങളുടെ ചുമതലയായിരുന്നു എന്ന് പറയാൻ.',
    natural_version: "I'm a software tester with two years of experience at TCS. I test web applications and write automation scripts.",
    praise: 'Nice — you kept going!',
    reply: finalTurn ? 'Thank you, that was great. Well done today!' : 'That sounds good. Can you tell me a bit more about that?',
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
- Otherwise invite them to a quick 5-minute English speaking practice. If they have an interview date coming up, mention it and encourage them.
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

// All the "teaching brain": prompts, JSON schemas and the calls that use them.
import { chatJson } from './openai.js';

// ─── Shared persona ──────────────────────────────────────────
const PERSONA = `You are "Base", a patient, warm English speaking partner for Malayalam speakers from Kerala.
Your learners understand English well in their heads but freeze, translate slowly, or lose confidence when they must speak.
Your job is to make speaking feel safe, keep the conversation flowing, and fix ONE habit at a time.

Ground rules:
- Use simple, natural, everyday English (CEFR A2–B1). Short sentences. No idioms they would not know.
- Never be sarcastic, never lecture, never list many errors.
- Learners may mix Malayalam words (in Malayalam script or romanised Manglish) into English when they get stuck. This is ENCOURAGED. Always understand what they meant and carry on normally.
- Stay in the role of the scenario. Ask exactly ONE question at a time.`;

function memoryBlock(user, summaries, topMistakes) {
  const lines = [];
  if (user?.name) lines.push(`Name: ${user.name}`);
  if (user?.job_role) lines.push(`Job / role: ${user.job_role}`);
  if (user?.goals) lines.push(`Goal: ${user.goals}`);
  let facts = [];
  try {
    facts = JSON.parse(user?.facts || '[]');
  } catch {}
  if (facts.length) lines.push(`Things they told you before: ${facts.join('; ')}`);
  if (summaries?.length) {
    lines.push('Recent sessions (newest first):');
    for (const s of summaries) lines.push(`- ${s.summary}`);
  }
  if (topMistakes?.length) {
    lines.push(`Habits they are working on: ${topMistakes.map((m) => m.label).join('; ')}`);
  }
  return lines.length ? `\nWhat you remember about this learner:\n${lines.join('\n')}` : '\nThis is a brand-new learner. You know nothing about them yet.';
}

// ─── 1. One conversational turn ──────────────────────────────
const TURN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['meaning', 'lifeline_words', 'correction', 'praise', 'reply', 'conversation_complete', 'learned'],
  properties: {
    meaning: { type: 'string', description: 'What the learner meant, as one natural English sentence or two.' },
    lifeline_words: {
      type: 'array',
      description: 'Every Malayalam (or Manglish) word/phrase they used because they were stuck, with the English for it.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['said', 'english', 'note_ml'],
        properties: {
          said: { type: 'string', description: 'Exactly what they said (Malayalam script or romanised).' },
          english: { type: 'string', description: 'The natural English word or short phrase for this context.' },
          note_ml: { type: 'string', description: 'Very short Malayalam gloss, e.g. "അവസരം = opportunity". May be empty.' },
        },
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
            you_said: { type: 'string', description: 'The learner\'s sentence (or the part of it) that has the mistake, quoted from the transcript.' },
            say_it_like_this: {
              type: 'string',
              description: 'ONE complete, natural English sentence (max ~18 words) the learner should say out loud. Keep their meaning and their words where possible. Must contain the English for any Malayalam word they used.',
            },
            explanation_ml: {
              type: 'string',
              description: 'ONE short line in simple, friendly Malayalam (Malayalam script; English grammar words like "past tense" may stay in English) explaining WHY.',
            },
            mistake_key: {
              type: 'string',
              description: 'Stable snake_case id for this habit so repeats can be counted, e.g. discuss_about, since_vs_for, present_continuous_for_habit, missing_article, did_plus_past, word:opportunity.',
            },
            mistake_label: { type: 'string', description: 'Short English label for the habit, e.g. \'Say "discuss", not "discuss about"\'.' },
            kind: { type: 'string', enum: ['grammar', 'word', 'phrasing'] },
          },
        },
      ],
    },
    praise: { type: 'string', description: 'A short, specific, genuine encouragement (max 10 words).' },
    reply: {
      type: 'string',
      description: 'Your next line in the role-play: a brief natural reaction to what they said + ONE next question. Max 2 short sentences. If conversation_complete is true, a warm closing line instead (no question).',
    },
    conversation_complete: { type: 'boolean' },
    learned: {
      type: 'array',
      description: 'New personal facts the learner revealed (name, job, company, city, goals, family, upcoming interview…). Short phrases. Empty if none.',
      items: { type: 'string' },
    },
  },
};

const TURN_RULES = `How to respond to each learner message:
1. Understand it fully, including Malayalam words. Put what they meant in "meaning".
2. "lifeline_words": list each Malayalam/Manglish word they used, with natural English. Ignore names of places/people/food.
3. "correction": pick ONLY the single most important thing to fix — the one that most affects how natural or clear they sound, preferring habits typical of Malayalam speakers:
   - "discuss about", "return back", "revert back", "cope up", "order for", "explain about"
   - present continuous for states/habits ("I am having two years experience", "I am knowing")
   - "since" vs "for" ("working since 2 years"), wrong present perfect vs past simple
   - "did + past verb" ("I didn't went"), missing/extra articles, "myself is …", "I am belonging to"
   - literal translations ("I will tell you after", "today morning", "what is your good name", "I am coming from Kochi" meaning "I am from")
   - question word order, plural/singular, prepositions
   If they used a Malayalam word and the English is otherwise fine, the correction is the full sentence with the English word in it (kind "word", key "word:<english>"), so they practise saying it.
   If the sentence is already natural and no Malayalam was used, set correction to null. Do NOT nitpick tiny things, punctuation, capital letters, or filler words ("uh", "like"). Indian English that is clear and natural is fine.
   Transcripts come from speech recognition: ignore likely mis-hearings and missing punctuation.
4. The explanation must be ONE line of simple, kind Malayalam that a 12th-standard student understands. No grammar jargon unless needed. Example: "'discuss' എന്നതിന് ശേഷം 'about' വേണ്ട — 'discuss the plan' എന്ന് മതി."
5. "reply": stay in character, react to their CONTENT (not their grammar), then ask ONE simple next question. Use the English word for anything they said in Malayalam so they hear it naturally.
6. Set conversation_complete=true only when told this is the final turn.`;

export async function coachTurn({ scenario, user, summaries, topMistakes, history, transcript, turnNumber, finalTurn }) {
  const system = `${PERSONA}

Scenario: You are ${scenario.role}.
${scenario.brief}
${memoryBlock(user, summaries, topMistakes)}

${TURN_RULES}`;

  const messages = history.map((m) => ({
    role: m.role === 'partner' ? 'assistant' : 'user',
    content: m.text,
  }));
  messages.push({
    role: 'user',
    content: `[Learner turn ${turnNumber} of ~${scenario.maxTurns}${finalTurn ? ' — FINAL TURN: wrap up warmly, conversation_complete=true' : ''}]\n${transcript}`,
  });

  return chatJson({
    system,
    messages,
    schemaName: 'coach_turn',
    schema: TURN_SCHEMA,
    mock: () => mockTurn(transcript, finalTurn),
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

Write your FIRST line to start this practice. Greet them by name if you know it, optionally refer briefly to something from a past session (like catching up with a friend), then ask the first question of the scenario. Max 2 short sentences. Stay in role.`;
  const r = await chatJson({
    system,
    messages: [{ role: 'user', content: 'Start the conversation.' }],
    schemaName: 'opener',
    schema: OPENER_SCHEMA,
    maxTokens: 200,
    mock: () => ({ opener: `Welcome back${user?.name ? ', ' + user.name : ''}! ${scenario.opener}` }),
  });
  return r.opener;
}

// ─── 3. End-of-session memory + coach note ───────────────────
const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'name', 'job_role', 'goals', 'facts', 'coach_note_ml'],
  properties: {
    summary: { type: 'string', description: 'One or two sentences for YOUR memory: what you talked about, any upcoming event (interview date, trip), how they did.' },
    name: { type: ['string', 'null'], description: 'Learner first name if they said it, else null.' },
    job_role: { type: ['string', 'null'], description: 'Their job / field / study if mentioned, else null.' },
    goals: { type: ['string', 'null'], description: 'Why they are practising (e.g. interview at Infosys next week) if mentioned, else null.' },
    facts: { type: 'array', items: { type: 'string' }, description: 'Up to 4 other short personal facts worth remembering.' },
    coach_note_ml: {
      type: 'string',
      description: 'A warm 1–2 sentence closing note to the learner, in simple Malayalam (Malayalam script) mixed with a little English, praising something specific and naming the one habit to watch.',
    },
  },
};

export async function summarizeSession({ scenario, user, history, mistakes }) {
  const transcript = history.map((m) => `${m.role === 'partner' ? 'Partner' : 'Learner'}: ${m.text}`).join('\n');
  const system = `${PERSONA}

You just finished a practice conversation (${scenario.title}). Write your memory notes and a closing note.
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
    }),
  });
}

// ─── Mock (MOCK_AI=1) ────────────────────────────────────────
function mockTurn(transcript, finalTurn) {
  const t = transcript.toLowerCase();
  let correction = null;
  let lifeline = [];
  if (t.includes('since two years')) {
    correction = {
      you_said: transcript,
      say_it_like_this: 'I have been working at TCS for two years as a tester.',
      explanation_ml: 'കാലയളവ് പറയുമ്പോൾ "since" അല്ല, "for" ആണ് — "for two years". ',
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
  return {
    meaning: transcript,
    lifeline_words: lifeline,
    correction,
    praise: 'Nice — you kept going!',
    reply: finalTurn ? 'That was a great chat. Well done today!' : 'That sounds interesting. Can you tell me a bit more about that?',
    conversation_complete: !!finalTurn,
    learned: [],
  };
}

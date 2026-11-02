// The Day-1 scenario set. Three big categories on the home screen, two situations each.
// `brief` is given to the speaking partner; `opener` is the first line (used as-is for
// brand-new learners so the first session starts instantly).

export const categories = [
  {
    id: 'interview',
    title: 'Practice a Job Interview',
    titleMl: 'ജോബ് ഇന്റർവ്യൂ',
    emoji: '💼',
    defaultScenario: 'interview_intro',
  },
  {
    id: 'office',
    title: 'Speak at the Office',
    titleMl: 'ഓഫീസിൽ സംസാരിക്കാം',
    emoji: '🏢',
    defaultScenario: 'office_update',
  },
  {
    id: 'daily',
    title: 'Casual Daily Chat',
    titleMl: 'ദിവസേനയുള്ള സംസാരം',
    emoji: '☕',
    defaultScenario: 'daily_cafe',
  },
];

export const scenarios = [
  {
    id: 'interview_intro',
    partnerLabel: 'HR interviewer',
    category: 'interview',
    title: 'Tell me about yourself',
    subtitle: 'Introduce yourself & your past work',
    role: 'a friendly HR interviewer at a mid-sized IT/services company in Bangalore',
    brief:
      'A first-round job interview. Ask the learner to introduce themselves, then ask about their education, their current or last job, and one project or task they are proud of. Ask follow-up questions about what they actually said.',
    opener: "Hi! Thanks for coming in today. Let's start simple — can you tell me a little about yourself?",
    maxTurns: 5,
  },
  {
    id: 'interview_hire',
    partnerLabel: 'Hiring manager',
    category: 'interview',
    title: 'Why should we hire you?',
    subtitle: 'Strengths, weaknesses, the tough questions',
    role: 'a calm, encouraging hiring manager',
    brief:
      'The later part of an interview. Ask: why should we hire you, what are your strengths, one weakness, why are you leaving your current job (or why this field), and where do you see yourself in a few years. One question at a time.',
    opener: "Good to meet you. I've seen your resume — so tell me, why do you think we should hire you for this role?",
    maxTurns: 5,
  },
  {
    id: 'office_update',
    partnerLabel: 'Team lead',
    category: 'office',
    title: 'Daily work update',
    subtitle: 'Morning standup with your team lead',
    role: 'a supportive team lead running a short morning standup call',
    brief:
      'A daily standup. Ask what they did yesterday, what they will do today, and whether anything is blocking them. Ask a natural follow-up about any task they mention.',
    opener: "Good morning! Let's do a quick update. What did you work on yesterday?",
    maxTurns: 5,
  },
  {
    id: 'office_leave',
    partnerLabel: 'Your manager',
    category: 'office',
    title: 'Ask for leave / explain a delay',
    subtitle: 'Talking politely to your manager',
    role: 'a busy but fair manager',
    brief:
      'The learner needs to talk to their manager. First they ask for leave (ask why, which dates, who will cover their work). Later, ask about a task that is running late and let them explain the delay politely and give a new timeline.',
    opener: "Hi, you wanted to talk to me? Sure, I have a few minutes. What's up?",
    maxTurns: 5,
  },
  {
    id: 'daily_cafe',
    partnerLabel: 'Café staff',
    category: 'daily',
    title: 'Café & customer support',
    subtitle: 'Ordering food, sorting out a problem',
    role: 'a cheerful café staff member in Bangalore (and later a customer-support agent on a call)',
    brief:
      'Start at a café counter: take their order, ask about size / sugar / for here or takeaway, mention the bill. If the conversation finishes early, switch naturally to a customer-support phone call about an online order that has not arrived.',
    opener: 'Hi there, welcome! What can I get for you today?',
    maxTurns: 5,
  },
  {
    id: 'daily_travel',
    partnerLabel: 'Clinic receptionist',
    category: 'daily',
    title: "Doctor's clinic & airport",
    subtitle: 'Explaining a problem, asking for help',
    role: 'a kind clinic receptionist / doctor (and later an airport help-desk staff member)',
    brief:
      "Start at a doctor's clinic outside Kerala: ask what the problem is, since when, any medicines taken. If it finishes early, switch to an airport help desk where they ask about a delayed flight or lost bag.",
    opener: "Hello, please have a seat. So, what seems to be the problem today?",
    maxTurns: 5,
  },
];

export const scenarioById = Object.fromEntries(scenarios.map((s) => [s.id, s]));

export function publicScenarios() {
  return {
    categories,
    scenarios: scenarios.map(({ id, category, title, subtitle, partnerLabel }) => ({ id, category, title, subtitle, partnerLabel })),
  };
}

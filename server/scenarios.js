// Everything here is about one goal: pass a job interview in English.
// A "scenario" is one interview round with its own interviewer and question focus. The LLM
// writes the actual questions, tailored to the learner's target role, experience and company.

// ─── Job tracks (picked during onboarding) ───────────────────
export const roles = [
  { id: 'it', label: 'Software / IT', ml: 'ഐടി / സോഫ്റ്റ്‌വെയർ' },
  { id: 'nursing', label: 'Nursing / Healthcare', ml: 'നഴ്സിംഗ് / ആരോഗ്യം' },
  { id: 'support', label: 'Customer support / BPO', ml: 'കസ്റ്റമർ സപ്പോർട്ട്' },
  { id: 'sales', label: 'Sales & marketing', ml: 'സെയിൽസ്' },
  { id: 'accounts', label: 'Accounts / Finance', ml: 'അക്കൗണ്ട്സ്' },
  { id: 'teaching', label: 'Teaching', ml: 'അധ്യാപനം' },
  { id: 'abroad', label: 'Job abroad (Gulf / UK)', ml: 'വിദേശ ജോലി' },
  { id: 'other', label: 'Something else', ml: 'മറ്റുള്ളവ' },
];
export const roleById = Object.fromEntries(roles.map((r) => [r.id, r]));

export const experienceLevels = [
  { id: 'fresher', label: 'Fresher', ml: 'ഫ്രഷർ' },
  { id: 'junior', label: '1–3 years', ml: '1–3 വർഷം' },
  { id: 'senior', label: '3+ years', ml: '3+ വർഷം' },
];

// Interview areas used for feedback, the readiness score and the question bank.
export const areas = [
  { id: 'intro', label: 'Introducing yourself', ml: 'സ്വയം പരിചയപ്പെടുത്തൽ' },
  { id: 'experience', label: 'Experience & projects', ml: 'അനുഭവം' },
  { id: 'strengths', label: 'Strengths & weaknesses', ml: 'കഴിവുകളും കുറവുകളും' },
  { id: 'role', label: 'Role questions', ml: 'ജോലി സംബന്ധമായ ചോദ്യങ്ങൾ' },
  { id: 'behavioural', label: 'Tough situations', ml: 'ബുദ്ധിമുട്ടുള്ള സാഹചര്യങ്ങൾ' },
  { id: 'motivation', label: 'Why you, why us', ml: 'എന്തുകൊണ്ട് നിങ്ങൾ' },
  { id: 'closing', label: 'Salary & closing', ml: 'ശമ്പളം, അവസാന ചോദ്യങ്ങൾ' },
];
export const areaIds = areas.map((a) => a.id);

// ─── Interview rounds ────────────────────────────────────────
export const scenarios = [
  {
    id: 'intro_yourself',
    title: 'Tell me about yourself',
    subtitle: 'The first 60 seconds that decide everything',
    partnerLabel: 'HR interviewer',
    role: 'a friendly but professional HR interviewer doing the first round',
    brief:
      'Start with "Tell me about yourself". Then ask short follow-ups on what they said: education, current/last role (or final-year project for freshers), and why they chose this field. Keep it realistic.',
    opener: "Hi, welcome! Thanks for coming in. Let's start — can you tell me a little about yourself?",
    areas: ['intro'],
    maxTurns: 4,
  },
  {
    id: 'resume_walk',
    title: 'Walk me through your resume',
    subtitle: 'Education, jobs, gaps and changes',
    partnerLabel: 'HR interviewer',
    role: 'an HR interviewer going through the candidate\'s resume',
    brief:
      'Ask them to walk you through their resume. Ask about their education, each job or internship, any gap year, and any change of field. Ask one realistic follow-up about something specific they mention.',
    opener: "I have your resume here. Could you walk me through it — start from your education?",
    areas: ['intro', 'experience'],
    maxTurns: 4,
  },
  {
    id: 'experience_star',
    title: 'Your experience & projects',
    subtitle: 'Explain what you did — and the result',
    partnerLabel: 'Hiring manager',
    role: 'a hiring manager who wants concrete examples',
    brief:
      'Ask about their day-to-day work, one project or achievement they are proud of (freshers: final-year project or internship), what exactly THEY did, and the result. Push gently for specifics and numbers.',
    opener: "Tell me about a project or piece of work you're really proud of. What was your part in it?",
    areas: ['experience'],
    maxTurns: 4,
  },
  {
    id: 'strengths',
    title: 'Strengths & weaknesses',
    subtitle: 'Sound confident without bragging',
    partnerLabel: 'HR interviewer',
    role: 'an HR interviewer',
    brief:
      'Ask: their biggest strength (and an example of it), their biggest weakness (and what they are doing about it), and how a colleague or teacher would describe them.',
    opener: 'What would you say is your biggest strength?',
    areas: ['strengths'],
    maxTurns: 4,
  },
  {
    id: 'role_questions',
    title: 'Questions for your role',
    subtitle: 'The job-specific round',
    partnerLabel: 'Team lead',
    role: 'the team lead for the exact role the candidate is applying for',
    brief:
      'Ask realistic, commonly asked questions for THEIR target role and experience level (e.g. IT: explain a technology/bug you fixed; nursing: patient care, handling an emergency, shift work; support/BPO: handling an angry customer, targets; sales: selling a product, targets; accounts: tools, reconciliation; teaching: classroom management). Keep questions answerable without deep technical jargon.',
    opener: "Let's talk about the job itself. What do you think are the most important skills for this role?",
    areas: ['role'],
    maxTurns: 4,
  },
  {
    id: 'behavioural',
    title: 'Tough situations',
    subtitle: 'Pressure, conflict and mistakes',
    partnerLabel: 'Manager',
    role: 'a calm manager asking behavioural questions',
    brief:
      'Ask behavioural questions one at a time: a time they worked under pressure or a tight deadline, a disagreement with a colleague, a mistake they made and what they learned. Expect a short situation → action → result story.',
    opener: 'Tell me about a time you had to work under a lot of pressure. What happened?',
    areas: ['behavioural'],
    maxTurns: 4,
  },
  {
    id: 'why_hire',
    title: 'Why should we hire you?',
    subtitle: 'Why this job, why this company, why you',
    partnerLabel: 'Hiring manager',
    role: 'a hiring manager in the final round',
    brief:
      'Ask: why should we hire you, why do you want to work at this company, where do you see yourself in five years, and (if they have a job) why are you leaving your current job.',
    opener: "So, out of all the candidates we're meeting — why should we hire you?",
    areas: ['motivation'],
    maxTurns: 4,
  },
  {
    id: 'salary_close',
    title: 'Salary & closing questions',
    subtitle: 'Expected salary, notice period, your questions',
    partnerLabel: 'HR interviewer',
    role: 'an HR interviewer wrapping up the process',
    brief:
      'Ask: expected salary, current salary or notice period, readiness for shifts/relocation/travel if relevant to their role, when they can join, and finally "Do you have any questions for us?". React like real HR.',
    opener: 'We are nearly done. What are your salary expectations for this role?',
    areas: ['closing'],
    maxTurns: 4,
  },
  {
    id: 'mock_full',
    title: 'Full mock interview',
    subtitle: 'The real thing, start to finish',
    partnerLabel: 'Interview panel',
    role: 'an interview panel running a complete realistic interview for the candidate\'s target role',
    brief:
      'Run a complete interview in this order, ONE question per turn: tell me about yourself → their experience or a project → one role-specific question → a strength or weakness → a pressure/conflict situation → why should we hire you → salary or notice period → "Any questions for us?". Adapt follow-ups to what they say.',
    opener: "Good morning, and thank you for coming. We'll go through a full interview today. Please introduce yourself.",
    areas: ['intro', 'experience', 'role', 'strengths', 'behavioural', 'motivation', 'closing'],
    maxTurns: 8,
  },
  {
    id: 'drill',
    title: 'Question practice',
    subtitle: 'One interview question',
    partnerLabel: 'Interviewer',
    role: 'an interviewer asking one practice question',
    brief: 'The candidate is practising one single interview question. After their answer, give a brief, warm closing line (no new question).',
    opener: 'Tell me about yourself.',
    areas: [],
    maxTurns: 1,
    hidden: true,
  },
];

export const scenarioById = Object.fromEntries(scenarios.map((s) => [s.id, s]));

export function publicScenarios() {
  return {
    scenarios: scenarios.filter((s) => !s.hidden).map(({ id, title, subtitle, partnerLabel }) => ({ id, title, subtitle, partnerLabel })),
    roles,
    experienceLevels,
    areas,
  };
}

// ─── The learning path: the interview, stage by stage ────────
export const units = [
  {
    id: 'u1', n: 1, title: 'First impressions', ml: 'ആദ്യ മതിപ്പ്', color: 'green',
    nodes: [
      { id: 'intro_yourself', type: 'lesson' },
      { id: 'resume_walk', type: 'lesson' },
      { id: 'u1_review', type: 'review' },
      { id: 'u1_chest', type: 'chest' },
    ],
  },
  {
    id: 'u2', n: 2, title: 'Your experience', ml: 'നിങ്ങളുടെ അനുഭവം', color: 'blue',
    nodes: [
      { id: 'experience_star', type: 'lesson' },
      { id: 'strengths', type: 'lesson' },
      { id: 'u2_review', type: 'review' },
      { id: 'u2_chest', type: 'chest' },
    ],
  },
  {
    id: 'u3', n: 3, title: 'The real questions', ml: 'ജോലിയുടെ ചോദ്യങ്ങൾ', color: 'clay',
    nodes: [
      { id: 'role_questions', type: 'lesson' },
      { id: 'behavioural', type: 'lesson' },
      { id: 'u3_review', type: 'review' },
      { id: 'u3_chest', type: 'chest' },
    ],
  },
  {
    id: 'u4', n: 4, title: 'Close the deal', ml: 'ഇന്റർവ്യൂ ജയിക്കാം', color: 'purple',
    nodes: [
      { id: 'why_hire', type: 'lesson' },
      { id: 'salary_close', type: 'lesson' },
      { id: 'u4_review', type: 'review' },
      { id: 'mock_full', type: 'lesson' },
      { id: 'u4_trophy', type: 'trophy' },
    ],
  },
];

// ─── Question bank (single-question drills) ──────────────────
const COMMON = {
  intro: ['Tell me about yourself.', 'How would you describe yourself in three words?', 'Walk me through your resume.', 'Why did you choose this field?'],
  experience: ['Tell me about a project you are proud of.', 'What did you do in your last job or internship?', 'What was your role in your final-year project?', 'Tell me about an achievement you are proud of.'],
  strengths: ['What is your biggest strength?', 'What is your biggest weakness?', 'How would your friends or colleagues describe you?'],
  behavioural: ['Tell me about a time you worked under pressure.', 'Describe a disagreement with a colleague and how you handled it.', 'Tell me about a mistake you made and what you learned.', 'How do you handle criticism?'],
  motivation: ['Why should we hire you?', 'Why do you want to work at our company?', 'Where do you see yourself in five years?', 'Why are you leaving your current job?'],
  closing: ['What are your salary expectations?', 'What is your notice period?', 'Are you comfortable with night shifts or relocation?', 'Do you have any questions for us?'],
};
const ROLE_QS = {
  it: ['Explain a project you built and the technologies you used.', 'How do you fix a bug you have never seen before?', 'How do you keep your technical skills up to date?'],
  nursing: ['How would you handle a patient who refuses medication?', 'Tell me about an emergency you handled.', 'How do you manage stress during long shifts?'],
  support: ['How would you handle an angry customer on a call?', 'How do you stay calm when you have many calls in a queue?', 'What does good customer service mean to you?'],
  sales: ['Sell me this pen.', 'How do you handle a customer who says "it is too expensive"?', 'How do you meet a monthly target?'],
  accounts: ['Which accounting software have you used?', 'How do you make sure there are no errors in your reports?', 'Explain GST to someone who is not from finance.'],
  teaching: ['How do you handle a student who disturbs the class?', 'How do you make a boring topic interesting?', 'How do you help a weak student catch up?'],
  abroad: ['Why do you want to work abroad?', 'How will you adjust to a new country and culture?', 'Are you ready to stay away from your family for long periods?'],
  other: ['What do you know about this role?', 'Which skills from your past will help you in this job?', 'How do you learn a new task quickly?'],
};

export function questionBank(roleId) {
  const role = ROLE_QS[roleId] ? roleId : 'other';
  return areas.map((a) => ({
    ...a,
    questions: a.id === 'role' ? ROLE_QS[role] : COMMON[a.id],
  }));
}

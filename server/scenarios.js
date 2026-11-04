// Base teaches spoken English to Malayalam speakers who want a (better) job.
// The goal is English; the job journey is the context: introducing yourself, talking about
// your work, phone & HR calls, interview answers, and English at the new job.

// ─── Job tracks (personalise the context and vocabulary) ─────
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

// Speaking situations — used for feedback, the "job-ready English" score and speaking practice.
export const areas = [
  { id: 'intro', label: 'Introducing yourself', ml: 'സ്വയം പരിചയപ്പെടുത്തൽ' },
  { id: 'work', label: 'Talking about your work', ml: 'ജോലിയെക്കുറിച്ച് സംസാരിക്കൽ' },
  { id: 'calls', label: 'Phone & HR calls', ml: 'ഫോൺ / HR കോളുകൾ' },
  { id: 'interview', label: 'Interview answers', ml: 'ഇന്റർവ്യൂ ഉത്തരങ്ങൾ' },
  { id: 'workplace', label: 'English at work', ml: 'ഓഫീസിലെ ഇംഗ്ലീഷ്' },
];
export const areaIds = areas.map((a) => a.id);

// ─── Speaking lessons (conversations) ────────────────────────
export const scenarios = [
  // Unit 1 — introduce yourself
  {
    id: 'intro_yourself', area: 'intro', title: 'Introduce yourself', subtitle: 'Name, studies, job — in clear English',
    partnerLabel: 'New friendly HR', role: 'a friendly HR person meeting the learner for the first time',
    brief: 'Ask them to introduce themselves, then simple follow-ups: where they are from, what they studied, what they do now. Keep questions short and easy.',
    opener: "Hi! Nice to meet you. Could you introduce yourself?", maxTurns: 4,
  },
  {
    id: 'background', area: 'intro', title: 'Your background', subtitle: 'Family, hometown, hobbies',
    partnerLabel: 'Friendly colleague', role: 'a friendly new colleague making small talk',
    brief: 'Make light small talk: their hometown, family, what they like doing in free time, why they chose their field. Simple questions, one at a time.',
    opener: "So, where are you from originally?", maxTurns: 4,
  },
  // Unit 2 — talk about your work
  {
    id: 'work_studies', area: 'work', title: 'Your work & studies', subtitle: 'Say what you do — and what you did',
    partnerLabel: 'Team lead', role: 'a team lead who wants to understand what the learner does',
    brief: 'Ask what they do every day in their job (freshers: their studies or internship), what they did last week, and what tools or skills they use. Encourage present and past tense.',
    opener: "Tell me — what do you do on a normal working day?", maxTurns: 4,
  },
  {
    id: 'experience_star', area: 'work', title: 'A project you are proud of', subtitle: 'Tell a short work story',
    partnerLabel: 'Hiring manager', role: 'a hiring manager who enjoys hearing work stories',
    brief: 'Ask about one project or achievement (freshers: final-year project or internship): what it was, what THEY did, a problem they faced and the result.',
    opener: "Tell me about a project or piece of work you're proud of.", maxTurns: 4,
  },
  // Unit 3 — phone & HR calls
  {
    id: 'hr_call', area: 'calls', title: 'HR screening call', subtitle: 'The first phone call from a company',
    partnerLabel: 'HR on the phone', role: 'an HR recruiter calling the learner on the phone about a job application',
    brief: 'Phone-call style: confirm who you are speaking to, check they applied, ask current role/notice period, expected salary, and fix an interview time. Short phone-style lines.',
    opener: "Hello, am I speaking with the candidate who applied for the opening at our company? This is Priya from HR.", maxTurns: 5,
  },
  {
    id: 'followup_call', area: 'calls', title: 'Reschedule & follow up', subtitle: 'Call HR politely about your interview',
    partnerLabel: 'HR receptionist', role: 'an HR receptionist answering the phone',
    brief: 'The learner is the caller. Play the receptionist: ask who is calling and why. They might need to reschedule an interview or ask about their application status. Ask polite clarifying questions.',
    opener: "Good morning, HR department. How can I help you?", maxTurns: 4,
  },
  // Unit 4 — interview English
  {
    id: 'strengths', area: 'interview', title: 'Strengths & weaknesses', subtitle: 'Describe yourself confidently',
    partnerLabel: 'Interviewer', role: 'a kind interviewer',
    brief: 'Ask about their biggest strength (with an example), a weakness and how they are improving, and how others would describe them.',
    opener: 'What would you say is your biggest strength?', maxTurns: 4,
  },
  {
    id: 'why_hire', area: 'interview', title: 'Why should we hire you?', subtitle: 'Talk about your goals',
    partnerLabel: 'Hiring manager', role: 'a hiring manager',
    brief: 'Ask why they want this job, why you should hire them, where they see themselves in five years.',
    opener: "Why do you want this job?", maxTurns: 4,
  },
  {
    id: 'role_questions', area: 'interview', title: 'Questions about your field', subtitle: 'Explain your work clearly',
    partnerLabel: 'Team lead', role: "a team lead from the learner's field",
    brief: "Ask simple, common questions for THEIR field (IT: a technology you know; nursing: caring for a patient; support: an angry customer; sales: selling a product; accounts: tools you use; teaching: a difficult student). Keep it about explaining clearly, not deep technical tests.",
    opener: "Let's talk about your field. What skills do you think are most important in your work?", maxTurns: 4,
  },
  {
    id: 'mock_full', area: 'interview', title: 'Full mock interview', subtitle: 'Put all your English together',
    partnerLabel: 'Interview panel', role: "an interview panel for the learner's target job",
    brief: 'Run a full but friendly interview, ONE question per turn: introduce yourself → your work or studies → a project → a strength → a difficult situation → why this job → notice period or availability → "any questions for us?".',
    opener: "Good morning, and welcome. Let's begin — please introduce yourself.", maxTurns: 8,
  },
  // Unit 5 — English at your new job
  {
    id: 'office_update', area: 'workplace', title: 'Daily team update', subtitle: 'Yesterday, today, any problems',
    partnerLabel: 'Team lead', role: 'a supportive team lead running a short morning standup',
    brief: 'Ask what they did yesterday, what they will do today and whether anything is blocking them. One follow-up about a task they mention.',
    opener: "Good morning! Quick update — what did you work on yesterday?", maxTurns: 4,
  },
  {
    id: 'office_leave', area: 'workplace', title: 'Leave & delays', subtitle: 'Ask your manager politely',
    partnerLabel: 'Manager', role: 'a busy but fair manager',
    brief: 'First they ask for leave (ask why, which dates, who covers their work). Then ask about a task that is late and let them explain politely with a new timeline.',
    opener: "Hi, you wanted to talk to me? Sure, I have a few minutes.", maxTurns: 4,
  },
  {
    id: 'customer_call', area: 'workplace', title: 'Talking to a customer', subtitle: 'Help, apologise, solve',
    partnerLabel: 'Customer', role: 'a slightly unhappy customer with a problem related to the learner\'s field (or a delayed order)',
    brief: 'Explain your problem. Let the learner greet, listen, apologise, ask questions and offer a solution. Calm down when they handle it well.',
    opener: "Hello? I've been waiting three days for an update and nobody has called me back.", maxTurns: 4,
  },
  // Single-question speaking practice
  {
    id: 'drill', area: null, title: 'Speaking practice', subtitle: 'One question',
    partnerLabel: 'Coach', role: 'a coach asking one practice question',
    brief: 'The learner is practising one question. After their answer, give a brief warm closing line (no new question).',
    opener: 'Tell me about yourself.', maxTurns: 1, hidden: true,
  },
];
export const scenarioById = Object.fromEntries(scenarios.map((s) => [s.id, s]));

export function publicScenarios() {
  return {
    scenarios: scenarios.filter((s) => !s.hidden).map(({ id, title, subtitle, partnerLabel, area }) => ({ id, title, subtitle, partnerLabel, area })),
    roles,
    experienceLevels,
    areas,
  };
}

// ─── Phrase lessons: the "learn" step of every unit ──────────
// Listen → understand (Malayalam) → say it out loud. Short, useful, job-related sentences.
export const phraseLessons = {
  u1_phrases: {
    title: 'Phrases to introduce yourself',
    phrases: [
      { en: "Hi, I'm Anjali. I'm from Thrissur.", ml: 'ഹായ്, ഞാൻ അഞ്ജലി. ഞാൻ തൃശ്ശൂരിൽ നിന്നാണ്.', note: 'Say "I\'m …", not "Myself …".' },
      { en: 'I completed my B.Com in 2022.', ml: '2022-ൽ ഞാൻ B.Com പൂർത്തിയാക്കി.', note: 'Use "completed" for finished studies.' },
      { en: 'I have two years of experience in customer support.', ml: 'കസ്റ്റമർ സപ്പോർട്ടിൽ എനിക്ക് രണ്ട് വർഷത്തെ പരിചയമുണ്ട്.', note: 'Not "I am having two years experience".' },
      { en: "I'm currently working as a sales executive.", ml: 'ഞാൻ ഇപ്പോൾ സെയിൽസ് എക്സിക്യൂട്ടീവ് ആയി ജോലി ചെയ്യുന്നു.', note: '"currently" = ഇപ്പോൾ.' },
      { en: 'In my free time, I enjoy reading.', ml: 'ഒഴിവു സമയത്ത് എനിക്ക് വായിക്കാൻ ഇഷ്ടമാണ്.', note: '"enjoy" + -ing: enjoy reading, enjoy cooking.' },
    ],
  },
  u2_phrases: {
    title: 'Phrases to talk about your work',
    phrases: [
      { en: 'I was responsible for handling customer complaints.', ml: 'കസ്റ്റമർ പരാതികൾ കൈകാര്യം ചെയ്യുന്നത് എന്റെ ചുമതലയായിരുന്നു.', note: '"responsible for" + -ing.' },
      { en: 'My main task was to prepare the daily reports.', ml: 'ദിവസേനയുള്ള റിപ്പോർട്ടുകൾ തയ്യാറാക്കലായിരുന്നു എന്റെ പ്രധാന ജോലി.', note: '"main task" = പ്രധാന ജോലി.' },
      { en: 'I worked on a project to reduce waiting time.', ml: 'കാത്തിരിപ്പ് സമയം കുറയ്ക്കാനുള്ള ഒരു പ്രോജക്റ്റിൽ ഞാൻ ജോലി ചെയ്തു.', note: '"worked on a project".' },
      { en: 'We finished the project two weeks early.', ml: 'ഞങ്ങൾ പ്രോജക്റ്റ് രണ്ടാഴ്ച നേരത്തെ പൂർത്തിയാക്കി.', note: 'Past tense: finish → finished.' },
      { en: 'I learned how to work under pressure.', ml: 'സമ്മർദ്ദത്തിൽ ജോലി ചെയ്യാൻ ഞാൻ പഠിച്ചു.', note: '"under pressure" = സമ്മർദ്ദത്തിൽ.' },
    ],
  },
  u3_phrases: {
    title: 'Phrases for phone & HR calls',
    phrases: [
      { en: 'Hello, this is Rahul speaking.', ml: 'ഹലോ, രാഹുൽ ആണ് സംസാരിക്കുന്നത്.', note: 'On the phone say "This is …", not "I am Rahul here".' },
      { en: 'Sorry, could you please repeat that?', ml: 'ക്ഷമിക്കണം, ഒന്നുകൂടി പറയാമോ?', note: 'Polite and safe when you miss something.' },
      { en: "I'm available for the interview on Monday morning.", ml: 'തിങ്കളാഴ്ച രാവിലെ ഇന്റർവ്യൂവിന് എനിക്ക് സൗകര്യമുണ്ട്.', note: '"available" = സൗകര്യമുണ്ട് / ഒഴിവുണ്ട്.' },
      { en: 'My notice period is thirty days.', ml: 'എന്റെ നോട്ടീസ് പീരിയഡ് മുപ്പത് ദിവസമാണ്.', note: 'HR asks this in almost every call.' },
      { en: 'Thank you for calling. I look forward to meeting you.', ml: 'വിളിച്ചതിന് നന്ദി. നിങ്ങളെ കാണാൻ കാത്തിരിക്കുന്നു.', note: '"look forward to" + -ing.' },
    ],
  },
  u4_phrases: {
    title: 'Phrases for interview answers',
    phrases: [
      { en: 'One of my strengths is that I learn quickly.', ml: 'വേഗം പഠിക്കും എന്നതാണ് എന്റെ ഒരു കഴിവ്.', note: 'A calm, confident way to start.' },
      { en: "I'm working on improving my public speaking.", ml: 'പൊതുവേദിയിൽ സംസാരിക്കാനുള്ള കഴിവ് ഞാൻ മെച്ചപ്പെടുത്തുകയാണ്.', note: 'Talk about a weakness + what you are doing.' },
      { en: "I believe I'm a good fit for this role because I enjoy working with people.", ml: 'ആളുകളോടൊപ്പം ജോലി ചെയ്യാൻ ഇഷ്ടമായതിനാൽ ഈ ജോലിക്ക് ഞാൻ അനുയോജ്യനാണെന്ന് ഞാൻ കരുതുന്നു.', note: '"a good fit" = അനുയോജ്യം.' },
      { en: 'In my last job, I handled a difficult customer calmly.', ml: 'കഴിഞ്ഞ ജോലിയിൽ, ബുദ്ധിമുട്ടുള്ള ഒരു കസ്റ്റമറെ ഞാൻ ശാന്തമായി കൈകാര്യം ചെയ്തു.', note: '"handled … calmly".' },
      { en: 'Could you tell me more about the team?', ml: 'ടീമിനെക്കുറിച്ച് കുറച്ചുകൂടി പറയാമോ?', note: 'A good question to ask at the end.' },
    ],
  },
  u5_phrases: {
    title: 'Phrases for English at work',
    phrases: [
      { en: "Yesterday I completed the testing, and today I'll work on the report.", ml: 'ഇന്നലെ ഞാൻ ടെസ്റ്റിംഗ് പൂർത്തിയാക്കി, ഇന്ന് റിപ്പോർട്ട് ചെയ്യും.', note: 'Past for yesterday, "I\'ll" for today.' },
      { en: 'Could I take leave on Friday? I have a family function.', ml: 'വെള്ളിയാഴ്ച ലീവ് എടുക്കാമോ? ഒരു കുടുംബ ചടങ്ങുണ്ട്.', note: '"Could I …?" is polite.' },
      { en: "Sorry for the delay. I'll send it by tomorrow evening.", ml: 'വൈകിയതിന് ക്ഷമിക്കണം. നാളെ വൈകുന്നേരത്തിനകം അയയ്ക്കാം.', note: '"by tomorrow" = നാളെക്കകം.' },
      { en: 'Let me check and get back to you.', ml: 'ഞാൻ നോക്കിയിട്ട് തിരിച്ചു പറയാം.', note: 'Instead of "I will tell you after".' },
      { en: 'We discussed the new plan in the meeting.', ml: 'മീറ്റിംഗിൽ ഞങ്ങൾ പുതിയ പ്ലാൻ ചർച്ച ചെയ്തു.', note: 'Say "discussed the plan", not "discussed about".' },
    ],
  },
};

// ─── The learning path ───────────────────────────────────────
export const units = [
  {
    id: 'u1', n: 1, title: 'Introduce yourself', ml: 'സ്വയം പരിചയപ്പെടുത്താം', color: 'green',
    nodes: [
      { id: 'u1_phrases', type: 'phrases' },
      { id: 'intro_yourself', type: 'lesson' },
      { id: 'background', type: 'lesson' },
      { id: 'u1_review', type: 'review' },
      { id: 'u1_chest', type: 'chest' },
    ],
  },
  {
    id: 'u2', n: 2, title: 'Talk about your work', ml: 'ജോലിയെക്കുറിച്ച് പറയാം', color: 'blue',
    nodes: [
      { id: 'u2_phrases', type: 'phrases' },
      { id: 'work_studies', type: 'lesson' },
      { id: 'experience_star', type: 'lesson' },
      { id: 'u2_review', type: 'review' },
      { id: 'u2_chest', type: 'chest' },
    ],
  },
  {
    id: 'u3', n: 3, title: 'Phone & HR calls', ml: 'ഫോൺ / HR കോളുകൾ', color: 'clay',
    nodes: [
      { id: 'u3_phrases', type: 'phrases' },
      { id: 'hr_call', type: 'lesson' },
      { id: 'followup_call', type: 'lesson' },
      { id: 'u3_review', type: 'review' },
      { id: 'u3_chest', type: 'chest' },
    ],
  },
  {
    id: 'u4', n: 4, title: 'English for interviews', ml: 'ഇന്റർവ്യൂവിനുള്ള ഇംഗ്ലീഷ്', color: 'purple',
    nodes: [
      { id: 'u4_phrases', type: 'phrases' },
      { id: 'strengths', type: 'lesson' },
      { id: 'why_hire', type: 'lesson' },
      { id: 'role_questions', type: 'lesson' },
      { id: 'u4_review', type: 'review' },
      { id: 'mock_full', type: 'lesson' },
    ],
  },
  {
    id: 'u5', n: 5, title: 'English at your new job', ml: 'പുതിയ ജോലിയിലെ ഇംഗ്ലീഷ്', color: 'green',
    nodes: [
      { id: 'u5_phrases', type: 'phrases' },
      { id: 'office_update', type: 'lesson' },
      { id: 'office_leave', type: 'lesson' },
      { id: 'customer_call', type: 'lesson' },
      { id: 'u5_review', type: 'review' },
      { id: 'u5_trophy', type: 'trophy' },
    ],
  },
];

// ─── Speaking practice: single questions by situation ────────
const COMMON = {
  intro: ['Tell me about yourself.', 'Where are you from?', 'What did you study?', 'What do you do in your free time?'],
  work: ['What do you do on a normal working day?', 'What did you do last week at work or college?', 'Tell me about a project you are proud of.', 'What tools or software do you use?'],
  calls: ['HR asks: "Is this a good time to talk?" — answer politely.', 'HR asks: "What is your notice period?"', 'HR asks: "What is your expected salary?"', 'Call HR to ask about your application status.'],
  interview: ['What is your biggest strength?', 'What is your biggest weakness?', 'Why should we hire you?', 'Where do you see yourself in five years?', 'Do you have any questions for us?'],
  workplace: ['Give your manager a quick update on your work.', 'Ask your manager for two days of leave.', 'Explain politely why your work is late.', 'A customer is angry about a delay. What do you say?'],
};
const ROLE_QS = {
  it: 'Explain a project you built and the technology you used.',
  nursing: 'How would you calm a patient who is scared?',
  support: 'How would you help an angry customer on a call?',
  sales: 'Sell me this pen.',
  accounts: 'Which accounting software have you used, and for what?',
  teaching: 'How do you handle a student who disturbs the class?',
  abroad: 'Why do you want to work abroad?',
  other: 'What do you know about the job you are applying for?',
};

export function questionBank(roleId) {
  const extra = ROLE_QS[roleId] || ROLE_QS.other;
  return areas.map((a) => ({ ...a, questions: a.id === 'work' ? [...COMMON.work, extra] : COMMON[a.id] }));
}

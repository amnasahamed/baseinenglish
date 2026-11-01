// Checks whether the learner said the corrected sentence. This is deliberately lenient:
// we are building the habit of saying the right words, NOT grading accent.

const CONTRACTIONS = {
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "he's": 'he is', "she's": 'she is',
  "it's": 'it is', "that's": 'that is', "what's": 'what is', "there's": 'there is', "i've": 'i have', "we've": 'we have',
  "you've": 'you have', "they've": 'they have', "i'll": 'i will', "we'll": 'we will', "you'll": 'you will', "it'll": 'it will',
  "i'd": 'i would', "we'd": 'we would', "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'cannot',
  "won't": 'will not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not', "haven't": 'have not',
  "hasn't": 'has not', "couldn't": 'could not', "wouldn't": 'would not', "shouldn't": 'should not', "let's": 'let us',
};
const NUMBERS = { '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten' };
const FILLERS = new Set(['uh', 'um', 'umm', 'uhh', 'ah', 'er', 'hmm', 'okay', 'ok', 'so', 'like', 'actually', 'basically', 'yeah']);

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'\sഀ-ൿ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => (CONTRACTIONS[w] ? CONTRACTIONS[w].split(' ') : [w]))
    .map((w) => NUMBERS[w] || w.replace(/'/g, ''))
    .map((w) => (w === 'cannot' ? 'can not' : w))
    .flatMap((w) => w.split(' '));
}

function lcs(a, b) {
  const dp = Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

/**
 * @returns {{pass:boolean, score:number, missing:string[]}}
 *   score = share of target words said in the right order. Extra words/fillers are forgiven.
 */
export function compareSpoken(spoken, target) {
  const t = normalize(target);
  const s = normalize(spoken).filter((w) => !FILLERS.has(w) || t.includes(w));
  if (!t.length) return { pass: true, score: 1, missing: [] };
  const common = lcs(t, s);
  const score = common / t.length;
  // Penalise long rambles that happen to contain the words.
  const tooLong = s.length > t.length * 2 + 4;
  const spokenSet = new Set(s);
  const missing = [...new Set(t.filter((w) => !spokenSet.has(w)))];
  const threshold = t.length <= 5 ? 0.75 : 0.8;
  return { pass: score >= threshold && !tooLong, score: Math.round(score * 100) / 100, missing: missing.slice(0, 5) };
}

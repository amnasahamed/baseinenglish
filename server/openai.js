// Thin wrapper around the three OpenAI endpoints we use. Plain fetch, no SDK, so model
// names and options are fully controlled from .env.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const headers = () => ({ Authorization: `Bearer ${config.openaiKey}` });

async function call(url, init, label) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    const body = await res.text();
    lastErr = new Error(`OpenAI ${label} failed (${res.status}): ${body.slice(0, 400)}`);
    lastErr.status = 502; // never leak upstream errors to learners; details go to the server log
    lastErr.upstreamStatus = res.status;
    if (res.status !== 429 && res.status < 500) break; // don't retry bad requests
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1) ** 2));
  }
  throw lastErr;
}

// ─── Speech → text ───────────────────────────────────────────
const STT_PROMPT =
  'Verbatim transcript of a Malayalam speaker practising spoken English. ' +
  'Keep every grammar mistake exactly as spoken — do NOT correct the English. ' +
  'Keep fillers like "uh". When the speaker uses a Malayalam word, write it in Malayalam script. ' +
  'Example: "Yesterday I am missed the ആ അവസരം because I was late."';

export async function transcribe(buffer, mimeType, { mockExpected } = {}) {
  if (config.mockAi) return mockTranscript(mockExpected);
  const ext = extFor(mimeType);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), `speech.${ext}`);
  form.append('model', config.sttModel);
  // Note: we intentionally do NOT pass the expected sentence on retries — that would bias the
  // transcript towards the "right" answer and let wrong habits slip through.
  form.append('prompt', STT_PROMPT);
  form.append('response_format', 'json');
  const res = await call(`${config.openaiBase}/audio/transcriptions`, { method: 'POST', headers: headers(), body: form }, 'transcription');
  const json = await res.json();
  return (json.text || '').trim();
}

function extFor(mime = '') {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  return 'webm';
}

// ─── Chat with JSON-schema output ────────────────────────────
export async function chatJson({ system, messages, schemaName, schema, maxTokens = 900, mock }) {
  if (config.mockAi) return mock();
  const body = {
    model: config.chatModel,
    messages: [{ role: 'system', content: system }, ...messages],
    response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
    max_completion_tokens: config.reasoningEffort ? maxTokens + 2000 : maxTokens,
  };
  if (config.reasoningEffort) body.reasoning_effort = config.reasoningEffort;
  const res = await call(
    `${config.openaiBase}/chat/completions`,
    { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    'chat',
  );
  const json = await res.json();
  const msg = json.choices?.[0]?.message;
  if (msg?.refusal) throw new Error('Model refused: ' + msg.refusal);
  return JSON.parse(msg?.content || '{}');
}

// ─── Text → speech (cached on disk) ──────────────────────────
const TTS_INSTRUCTIONS =
  'You are a warm, patient English-speaking coach talking to a nervous learner from Kerala. ' +
  'Speak clearly and a little slower than normal, with a friendly, encouraging, neutral international accent. Never sound rushed.';

const ttsDir = path.join(config.dataDir, 'tts-cache');
fs.mkdirSync(ttsDir, { recursive: true });

export async function speak(text, { slow = false } = {}) {
  const clean = String(text || '').slice(0, 800);
  const key = crypto.createHash('sha1').update(`${config.ttsModel}|${config.ttsVoice}|${slow}|${clean}`).digest('hex');
  const file = path.join(ttsDir, key + '.mp3');
  if (fs.existsSync(file)) return fs.readFileSync(file);
  if (config.mockAi) return null;
  const body = {
    model: config.ttsModel,
    voice: config.ttsVoice,
    input: clean,
    response_format: 'mp3',
  };
  // `instructions` is only supported by the gpt-4o-*-tts models.
  if (config.ttsModel.includes('gpt-4o')) {
    body.instructions = slow ? TTS_INSTRUCTIONS + ' Read this single sentence slowly, as a model for the learner to repeat.' : TTS_INSTRUCTIONS;
  } else if (slow) {
    body.speed = 0.85;
  }
  const res = await call(
    `${config.openaiBase}/audio/speech`,
    { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    'tts',
  );
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFile(file, buf, () => {});
  return buf;
}

// ─── Mock mode (UI testing without a key) ────────────────────
const MOCK_LINES = [
  'I am working in TCS since two years as a tester.',
  'Yesterday I missed the ആ അവസരം because I was late.',
  'We discussed about the new project in the meeting.',
  'I have completed my BTech in 2021 from Kochi.',
  'I want to improve my communication skills.',
];
let mockI = 0;
function mockTranscript(hint) {
  if (hint) return hint;
  return MOCK_LINES[mockI++ % MOCK_LINES.length];
}

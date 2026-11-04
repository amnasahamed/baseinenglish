// Base in English — single-page app (no build step).
const $app = document.getElementById('app');

// ─── Helpers ─────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (form) opts.body = form;
  else if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch('/api' + path, opts);
  } catch {
    throw Object.assign(new Error('No internet connection. Please check and try again.'), { status: 0 });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status, data });
  return data;
}

const track = (type, data, sessionId) => api('/events', { method: 'POST', body: { type, data, sessionId } }).catch(() => {});

let toastTimer;
function toast(msg, ms = 3200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ─── Icons (inline stroke SVG, inherit currentColor) ────────
const svg = (d, { size = 22, fill = 'none', sw = 2 } = {}) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${fill === 'none' ? 'currentColor' : 'none'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  mic: (s) => svg('<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>', { size: s || 22, sw: 2.2 }),
  play: (s) => `<svg width="${s || 16}" height="${s || 16}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  speaker: (s) => svg('<path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>', { size: s || 20 }),
  flame: (s) => `<svg width="${s || 16}" height="${s || 16}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></svg>`,
  check: (s) => svg('<path d="M5 12l5 5L20 7"/>', { size: s || 14, sw: 3 }),
  arrow: (s) => svg('<path d="M5 12h14M13 6l6 6-6 6"/>', { size: s || 18, sw: 2.4 }),
  chev: (s) => svg('<path d="M9 6l6 6-6 6"/>', { size: s || 20, sw: 2.4 }),
  back: (s) => svg('<path d="M15 6l-6 6 6 6"/>', { size: s || 18, sw: 2.4 }),
  close: (s) => svg('<path d="M6 6l12 12M18 6L6 18"/>', { size: s || 18, sw: 2.4 }),
  keyboard: (s) => svg('<rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>', { size: s || 24 }),
  bolt: (s) => svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', { size: s || 24, sw: 2.2 }),
  book: (s) => svg('<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4zM8 9h8M8 13h5"/>', { size: s || 22 }),
  briefcase: (s) => svg('<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>', { size: s || 24 }),
  building: (s) => svg('<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M2 21h20"/>', { size: s || 22 }),
  cup: (s) => svg('<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2c0 1.5 1 1.5 1 3M12 2c0 1.5 1 1.5 1 3"/>', { size: s || 22 }),
  buoy: (s) => svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>', { size: s || 30 }),
  thumb: (s, down) => svg('<path d="M7 10v11H4V10zM7 10l4-7a2 2 0 0 1 2.8 2.3L13 10h6a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.6 21H7"/>', { size: s || 18 }).replace('<svg ', down ? '<svg style="transform:rotate(180deg)" ' : '<svg '),
  bulb: (s) => svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>', { size: s || 24 }),
  sprout: (s) => svg('<path d="M12 21v-9M12 12c0-4 3-7 8-7 0 4-3 7-8 7zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/>', { size: s || 36 }),
  trophy: (s) => svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>', { size: s || 36 }),
  moon: (s) => svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', { size: s || 36 }),
  sparkle: (s) => svg('<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>', { size: s || 36 }),
  headset: (s) => svg('<path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2zM20 14a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z"/>', { size: s || 20 }),
  share: (s) => svg('<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>', { size: s || 20 }),
  gift: (s) => svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5"/>', { size: s || 22 }),
  bell: (s) => svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>', { size: s || 22 }),
  shield: (s) => svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', { size: s || 22 }),
  info: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>', { size: s || 22 }),
  chat: (s) => svg('<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.5A8 8 0 1 1 21 12z"/>', { size: s || 22 }),
  trash: (s) => svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', { size: s || 22 }),
  target: (s) => svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', { size: s || 22 }),
  path: (s) => svg('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>', { size: s || 24, sw: 2.2 }),
  chart: (s) => svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', { size: s || 24, sw: 2.2 }),
  user: (s) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', { size: s || 24, sw: 2.2 }),
  calendar: (s) => svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', { size: s || 20, sw: 2.2 }),
  snow: (s) => svg('<path d="M12 2v20M4.9 6l14.2 12M4.9 18L19.1 6M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>', { size: s || 18 }),
  chest: (s) => svg('<path d="M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9H3zM3 12h18M10 12v3h4v-3"/>', { size: s || 24 }),
  star: (s) => `<svg width="${s || 24}" height="${s || 24}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>`,
  lock: (s) => svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', { size: s || 20 }),
  trend: (s) => svg('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', { size: s || 20 }),
};
const CAT_ICON = { interview: I.briefcase, office: I.building, daily: I.cup };
const LOGO = `<span class="logo"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-4l-5 4v-4.2A4 4 0 0 1 4 13z" fill="#FBF6EC"/><circle cx="9" cy="10" r="1.4" fill="#E2A93B"/><circle cx="12" cy="10" r="1.4" fill="#E2A93B"/><circle cx="15" cy="10" r="1.4" fill="#E2A93B"/></svg></span>`;
const avatar = (cls = '') => `<span class="avatar ${cls}" aria-hidden="true"><span class="eyes"><i></i><i></i></span><span class="smile"></span></span>`;
const SQUIGGLE = `<svg viewBox="0 0 74 12" fill="none" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8c10-6 18-6 24-2s14 4 22-1 16-4 24 1" stroke="#E2A93B" stroke-width="3.5" stroke-linecap="round"/></svg>`;
const MIC_SVG = I.mic(38);
const STOP_SVG = `<span class="stopsq"></span>`;

/** Wrap Malayalam runs in learner text so they show as gold "lifeline" chips. */
const markMl = (t) => esc(t).replace(/([ഀ-ൿ][ഀ-ൿ\s]*[ഀ-ൿ]|[ഀ-ൿ])/g, '<span class="mlw">$1</span>');

function celebrate(text = 'Perfect!', ml = 'നന്നായി! അങ്ങനെ തന്നെ') {
  const box = document.getElementById('celebrate');
  box.innerHTML = '';
  const colors = ['#E2A93B', '#0E5A4A', '#E5533D', '#FBEBC8', '#1A6E5C'];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = 120 + Math.random() * 90;
    const b = h(`<span class="bit"></span>`);
    b.style.background = colors[i % colors.length];
    if (i % 3 === 0) b.style.borderRadius = '50%';
    b.style.setProperty('--x', `${Math.cos(a) * r}px`);
    b.style.setProperty('--y', `${Math.sin(a) * r}px`);
    b.style.setProperty('--r', `${Math.random() * 540}deg`);
    box.appendChild(b);
  }
  box.appendChild(h(`<div class="msg">${esc(text)}<span class="ml">${esc(ml)}</span></div>`));
  if (navigator.vibrate) navigator.vibrate(40);
  setTimeout(() => (box.innerHTML = ''), 1600);
}

// ─── Audio out (partner voice) ───────────────────────────────
const player = new Audio();
player.preload = 'auto';
const ttsCache = new Map();
let audioUnlocked = false;
function silentWav() {
  // 0.05s of silence, generated so we don't ship a binary blob.
  const n = 400, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  // A silent play during a user tap lets later (async) plays work on iOS Safari.
  player.src = silentWav();
  player.play().catch(() => {});
}

function stopSpeaking() {
  player.pause();
  if (window.speechSynthesis) speechSynthesis.cancel();
}

async function say(text, { slow = false } = {}) {
  stopSpeaking();
  const key = (slow ? 's|' : 'n|') + text;
  try {
    let url = ttsCache.get(key);
    if (url === undefined) {
      const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, slow }) });
      if (res.status === 200) url = URL.createObjectURL(await res.blob());
      else url = null;
      ttsCache.set(key, url);
    }
    if (url) {
      player.src = url;
      try {
        await player.play();
      } catch (e) {
        if (e.name === 'NotAllowedError') return; // autoplay blocked — learner can tap Replay
        throw e;
      }
      await new Promise((r) => {
        player.onended = r;
        player.onpause = r;
      });
      return;
    }
  } catch {
    /* fall through to browser voice */
  }
  if (window.speechSynthesis) {
    await new Promise((r) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-IN';
      u.rate = slow ? 0.8 : 0.95;
      u.onend = r;
      u.onerror = r;
      speechSynthesis.speak(u);
    });
  }
}

// ─── Audio in (tap to start / tap to stop) ───────────────────
class Recorder {
  constructor() {
    this.stream = null;
  }
  static supported() {
    return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  }
  async start(onLevel) {
    if (!this.stream || !this.stream.active) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    }
    const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported?.(t));
    this.rec = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
    this.startedAt = performance.now();
    if (onLevel) {
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const src = this.ctx.createMediaStreamSource(this.stream);
        const an = this.ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        const tick = () => {
          if (!this.rec || this.rec.state !== 'recording') return src.disconnect();
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
          requestAnimationFrame(tick);
        };
        tick();
      } catch {}
    }
  }
  stop() {
    return new Promise((resolve) => {
      if (!this.rec || this.rec.state === 'inactive') return resolve(null);
      this.rec.onstop = () => {
        const type = this.rec.mimeType || this.chunks[0]?.type || 'audio/webm';
        const blob = new Blob(this.chunks, { type });
        resolve({ blob, type, duration: (performance.now() - this.startedAt) / 1000 });
      };
      this.rec.stop();
    });
  }
  cancel() {
    if (this.rec && this.rec.state !== 'inactive') {
      this.rec.onstop = null;
      this.rec.stop();
    }
  }
  release() {
    this.cancel();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
const recorder = new Recorder();

/**
 * Turns a button into a tap-to-talk control. Calls onAudio({blob,type,duration}) when the learner taps stop.
 * Returns {setBusy, isRecording, cancel}.
 */
function micControl(btn, { onAudio, onState, maxSec = 120, icon = MIC_SVG, stopIcon = STOP_SVG, autoStop }) {
  let recording = false;
  let timer;
  let heard = false;
  let lastLoud = 0;
  const ring = btn.querySelector('.ring');
  const setUi = (state) => {
    recording = state === 'recording';
    btn.classList.toggle('recording', recording);
    btn.innerHTML = (recording ? stopIcon : icon) + (ring ? '<span class="ring"></span>' : '');
    btn.setAttribute('aria-label', recording ? 'Stop and send' : 'Tap to speak');
    onState?.(state);
  };
  btn.addEventListener('click', async () => {
    unlockAudio();
    if (btn.disabled) return;
    if (!recording) {
      stopSpeaking();
      if (!(await primeMic())) return;
      heard = false;
      lastLoud = performance.now();
      try {
        await recorder.start((lvl) => {
          btn.querySelector('.ring')?.style.setProperty('--lvl', String(1 + lvl * 0.5));
          // Hands-free: stop by itself after ~2.2s of quiet once the learner has spoken.
          if (!autoStop?.() || !recording) return;
          const t = performance.now();
          if (lvl > 0.12) {
            heard = true;
            lastLoud = t;
          } else if (heard && t - lastLoud > 2200) {
            heard = false;
            btn.click();
          }
        });
      } catch (e) {
        toast(e.name === 'NotAllowedError' ? 'Microphone is blocked. Allow it in your browser settings to practise speaking.' : 'Could not start the microphone.');
        return;
      }
      setUi('recording');
      const started = Date.now();
      timer = setInterval(() => {
        const s = Math.floor((Date.now() - started) / 1000);
        onState?.('tick', s);
        if (s >= maxSec) btn.click();
      }, 500);
    } else {
      clearInterval(timer);
      setUi('idle');
      const out = await recorder.stop();
      if (!out || out.duration < 0.7 || out.blob.size < 1200) {
        toast('Tap once to start, speak, then tap again when you are done.');
        return;
      }
      onAudio(out);
    }
  });
  return {
    start() {
      if (!recording && !btn.disabled) btn.click();
    },
    cancel() {
      clearInterval(timer);
      recorder.cancel();
      setUi('idle');
    },
    get recording() {
      return recording;
    },
  };
}

function audioForm(out, fields = {}) {
  const f = new FormData();
  const ext = out.type.includes('mp4') ? 'mp4' : out.type.includes('ogg') ? 'ogg' : 'webm';
  f.append('audio', out.blob, `speech.${ext}`);
  f.append('durationSec', String(Math.round(out.duration * 10) / 10));
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) f.append(k, String(v));
  return f;
}

// ─── Preferences (this device only) ──────────────────────────
const prefs = {
  get(k, d) {
    try {
      const v = localStorage.getItem('bie:' + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('bie:' + k, JSON.stringify(v));
    } catch {}
  },
};

/** Permission priming: explain why we need the mic before the browser's scary prompt. */
async function primeMic() {
  if (prefs.get('micPrimed', false)) return true;
  try {
    const st = await navigator.permissions?.query({ name: 'microphone' });
    if (st?.state === 'granted') {
      prefs.set('micPrimed', true);
      return true;
    }
  } catch {}
  return new Promise((resolve) => {
    const sheet = h(`<div class="sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="mic-t">
      <div class="sheet">
        <div class="sheet-art">${I.mic(40)}</div>
        <h2 id="mic-t">Base needs to hear you</h2>
        <p class="ml" style="margin:0 0 6px">നിങ്ങൾ സംസാരിക്കുന്നത് കേൾക്കാൻ mic വേണം.</p>
        <p class="small" style="margin:0 0 18px">Only the words you say are kept, as text — never your recording. Next, your phone will ask: tap <b>Allow</b>.</p>
        <button class="btn block" data-ok>Turn on microphone</button>
        <button class="btn ghost block" data-no>Not now</button>
      </div></div>`);
    const close = (v) => {
      sheet.classList.add('out');
      setTimeout(() => sheet.remove(), 200);
      if (v) {
        prefs.set('micPrimed', true);
        track('mic_primed');
      }
      resolve(v);
    };
    sheet.querySelector('[data-ok]').addEventListener('click', () => close(true));
    sheet.querySelector('[data-no]').addEventListener('click', () => close(false));
    sheet.addEventListener('click', (e) => e.target === sheet && close(false));
    document.body.append(sheet);
    sheet.querySelector('[data-ok]').focus();
  });
}

// ─── Feel: sound, haptics, floating rewards ──────────────────
// Short synthesized sounds (no files to download). Respect the in-app sound switch.
const sfx = (() => {
  let ctx;
  const on = () => prefs.get('sound', true);
  const tone = (freq, t0, dur, { type = 'sine', vol = 0.12 } = {}) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime + t0);
    g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + t0);
    o.stop(ctx.currentTime + t0 + dur + 0.05);
  };
  const play = (notes) => {
    if (!on()) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      notes.forEach((n) => tone(...n));
    } catch {}
  };
  return {
    tap: () => play([[660, 0, 0.06, { type: 'triangle', vol: 0.05 }]]),
    send: () => play([[520, 0, 0.08, { type: 'triangle', vol: 0.07 }], [780, 0.06, 0.1, { type: 'triangle', vol: 0.06 }]]),
    success: () => play([[659, 0, 0.12], [880, 0.1, 0.12], [1175, 0.2, 0.22]]),
    xp: () => play([[1046, 0, 0.07, { type: 'triangle', vol: 0.05 }], [1318, 0.05, 0.1, { type: 'triangle', vol: 0.05 }]]),
    level: () => play([[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1046, 0.36, 0.4, { vol: 0.14 }]]),
    soft: () => play([[392, 0, 0.12, { type: 'triangle', vol: 0.05 }]]),
    ring: () => play([[784, 0, 0.18, { vol: 0.08 }], [988, 0.2, 0.18, { vol: 0.08 }], [784, 0.45, 0.18, { vol: 0.08 }], [988, 0.65, 0.18, { vol: 0.08 }]]),
  };
})();
const buzz = (p) => {
  try {
    navigator.vibrate?.(p);
  } catch {}
};

/** "+10 XP" that floats up from an element. */
function floatXp(amount, from) {
  if (!amount) return;
  const r = (from || document.querySelector('.mic') || document.body).getBoundingClientRect();
  const el = h(`<div class="xp-float">+${amount} XP</div>`);
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top + Math.min(r.height, 40) / 2}px`;
  document.body.append(el);
  sfx.xp();
  setTimeout(() => el.remove(), 1300);
}

/** Apply a rewards payload from the server: XP float, level-up, goal reached. */
function handleRewards(rw, from) {
  if (!rw) return;
  const before = state.me?.level?.level;
  if (rw.xp) floatXp(rw.xp, from);
  if (state.me && rw.level) state.me.level = rw.level;
  if (before && rw.level && rw.level.level > before) {
    setTimeout(() => {
      sfx.level();
      buzz([30, 40, 60]);
      celebrate(`Level ${rw.level.level}!`, rw.level.ml);
    }, 700);
  } else if (rw.goalMet) {
    setTimeout(() => {
      sfx.level();
      celebrate("Today's goal done!", 'ഇന്നത്തെ ലക്ഷ്യം പൂർത്തിയായി');
    }, 700);
  }
}

/** Count up a number inside an element. */
function countUp(el, to, ms = 900) {
  const start = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - start) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ─── App state & routing ─────────────────────────────────────
const state = { me: null, scenarios: null, cleanup: null };

async function loadMe() {
  const [me, meta] = await Promise.all([api('/me'), state.meta || api('/scenarios')]);
  state.me = me;
  state.meta = meta;
  return state.me;
}

const routes = [
  [/^#?\/?$/, renderStory],
  [/^#\/path$/, renderLearn],
  [/^#\/base$/, renderChat],
  [/^#\/call\/(\w+)$/, renderIncoming],
  [/^#\/phrases$/, renderPhrasesTab],
  [/^#\/practice$/, renderPractice],
  [/^#\/job$/, async () => {
    await loadMe();
    renderJobPicker(() => go('#/'), { title: 'Your target job', cta: 'Save' });
  }],
  [/^#\/answers$/, renderAnswers],
  [/^#\/learn\/(\w+)$/, renderPhraseLesson],
  [/^#\/phrasebook$/, renderPhrasebook],
  [/^#\/questions$/, renderQuestions],
  [/^#\/progress$/, renderProgress],
  [/^#\/talk\/(\w+)$/, renderTalk],
  [/^#\/bank$/, renderBank],
  [/^#\/warmup(?:\/(\w+))?$/, renderWarmup],
  [/^#\/login$/, renderLogin],
  [/^#\/profile$/, renderSettings],
  [/^#\/settings$/, renderSettings],
  [/^#\/invite$/, renderInvite],
  [/^#\/badges$/, renderBadges],
  [/^#\/privacy$/, () => renderLegal('privacy')],
  [/^#\/terms$/, () => renderLegal('terms')],
  [/^#\/upgrade$/, renderUpgrade],
];

async function router() {
  state.cleanup?.();
  state.cleanup = null;
  stopSpeaking();
  window.scrollTo(0, 0);
  const hash = location.hash || '#/';
  for (const [re, fn] of routes) {
    const m = hash.match(re);
    if (m) {
      try {
        await fn(...m.slice(1));
      } catch (e) {
        console.error(e);
        $app.innerHTML = '';
        $app.append(emptyState(I.sparkle(), 'Something went wrong', esc(e.message), `<button class="btn" onclick="location.reload()">Try again</button>`));
      }
      setTabbar(hash);
      // Gentle screen entrance + move focus to the new screen's heading for screen readers.
      $app.classList.remove('enter');
      void $app.offsetWidth;
      $app.classList.add('enter');
      $app.querySelector('h1')?.setAttribute('tabindex', '-1');
      if (document.activeElement === document.body || !$app.contains(document.activeElement)) $app.querySelector('h1')?.focus({ preventScroll: true });
      return;
    }
  }
  location.hash = '#/';
}
window.addEventListener('hashchange', router);
const go = (hash) => (location.hash === hash ? router() : (location.hash = hash));

function topbar({ back } = {}) {
  const me = state.me;
  const streak = me?.stats?.streak || 0;
  const initial = (me?.user?.name || '').trim().charAt(0).toUpperCase();
  const el = h(`<header class="topbar">
    ${back ? `<button class="round-btn" data-back aria-label="Back">${I.back()}</button>` : `<a class="brand" href="#/">${LOGO}<span class="wordmark">base<i>.</i></span></a>`}
    <span class="spacer"></span>
    ${me?.level?.xp ? `<a class="pill xp-pill" href="#/badges" title="Level ${me.level.level} · ${me.level.xp} XP"><span class="lv">${me.level.level}</span>${me.level.xp}<small>XP</small></a>` : ''}
    ${streak ? `<span class="pill" title="Days in a row" style="color:var(--gold-ink)">${I.flame()}<span style="color:var(--ink)">${streak}</span></span>` : ''}
    ${me?.user?.isGuest ? `<a class="pill outline" href="#/login">Log in</a>` : `<a class="initial" href="#/settings" aria-label="Settings">${esc(initial || '•')}</a>`}
  </header>`);
  el.querySelector('[data-back]')?.addEventListener('click', () => (history.length > 1 ? history.back() : go('#/')));
  return el;
}

function emptyState(icon, title, text, cta = '') {
  return h(`<div class="empty"><div class="art" style="color:var(--gold-ink)">${icon}</div><h2>${esc(title)}</h2><p>${text}</p>${cta}</div>`);
}

// ─── Home ────────────────────────────────────────────────────
function goalRing(sec, goalMin) {
  const pct = Math.min(1, sec / (goalMin * 60));
  const C = 2 * Math.PI * 26;
  const done = pct >= 1;
  return `<div class="ring-wrap" role="img" aria-label="${Math.floor(sec / 60)} of ${goalMin} minutes spoken today">
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="#24332f" stroke-width="7"/>
    <circle cx="32" cy="32" r="26" fill="none" stroke="${done ? '#E2A93B' : '#E2A93B'}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" stroke-opacity="${pct > 0.01 ? 1 : 0}" transform="rotate(-90 32 32)" class="ring-arc"/></svg>
    <span class="ring-in">${done ? I.check(18) : `${Math.floor(sec / 60)}<small>/${goalMin}</small>`}</span></div>`;
}

function trendLine(now, prev, unit, betterWhenLower = false) {
  if (!prev) return '';
  const diff = Math.round((now - prev) * 10) / 10;
  if (!diff) return `<span class="trend flat">same as last week</span>`;
  const good = betterWhenLower ? diff < 0 : diff > 0;
  return `<span class="trend ${good ? 'up' : 'flat'}">${diff > 0 ? '+' : ''}${diff}${unit} vs last week</span>`;
}

function questCard(q) {
  const el = h(`<div class="quests">
    <div class="q-head"><b>Daily quests</b><span class="small">${q.quests.filter((x) => x.progress >= x.target).length}/3</span></div>
    ${q.quests
      .map((x) => {
        const pct = Math.round((x.progress / x.target) * 100);
        const done = x.progress >= x.target;
        const label = x.unit === 'sec' ? `${Math.floor(x.progress / 60)}/${Math.round(x.target / 60)} min` : `${x.progress}/${x.target}`;
        return `<div class="q ${done ? 'done' : ''}"><span class="q-ic">${done ? I.check(14) : ''}</span><span class="q-t">${esc(x.title)}<span class="q-bar"><i style="width:${pct}%"></i></span></span><span class="q-n">${label}</span></div>`;
      })
      .join('')}
    <button class="chest ${q.allDone && !q.claimed ? 'ready' : ''} ${q.claimed ? 'claimed' : ''}" ${q.allDone && !q.claimed ? '' : 'disabled'} aria-label="${q.claimed ? 'Chest opened' : q.allDone ? 'Open your reward chest' : 'Finish all quests to open the chest'}">
      ${I.chest(26)}<span>${q.claimed ? 'Opened · see you tomorrow' : q.allDone ? `Open chest · +${q.chestXp} XP` : `Finish all 3 · +${q.chestXp} XP`}</span>
    </button>
  </div>`);
  const btn = el.querySelector('.chest');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const r = await api('/quests/claim', { method: 'POST' }).catch(() => null);
    if (r?.gained) {
      sfx.level();
      buzz([30, 50, 80]);
      celebrate(`+${r.gained} XP`, 'ഇന്നത്തെ സമ്മാനം!');
      if (state.me) state.me.level = r.level;
      btn.classList.remove('ready');
      btn.classList.add('claimed');
      btn.querySelector('span').textContent = 'Opened · see you tomorrow';
    }
  });
  return el;
}

// ─── Badges & levels ─────────────────────────────────────────
async function renderBadges() {
  if (!state.me) await loadMe();
  const r = await api('/badges');
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  const L = r.level;
  $app.append(
    h(`<section class="lvl-hero">
      <div class="lv-badge big">${L.level}</div>
      <h1 class="center" style="margin-top:12px">${esc(L.name)}</h1>
      <p class="center ml" style="margin:0;color:var(--ink-2)">${esc(L.ml)}</p>
      <div class="lv-bar wide"><i style="width:${Math.round(L.progress * 100)}%"></i></div>
      <p class="small center">${L.xp} XP${L.next ? ` · ${L.next - L.xp} to level ${L.level + 1}` : ''}</p>
    </section>`),
  );
  $app.append(h(`<h2>Badges</h2>`));
  $app.append(
    h(`<div class="badges">${r.badges
      .map((b) => `<div class="badge-tile ${b.earned ? 'on' : ''} ${r.fresh.some((f) => f.id === b.id) ? 'fresh' : ''}"><span class="bt-ic">${b.earned ? I.star(26) : I.lock(20)}</span><b>${esc(b.name)}</b><span class="ml">${esc(b.ml)}</span></div>`)
      .join('')}</div>`),
  );
  $app.append(h(`<h2>The road ahead</h2>`));
  $app.append(
    h(`<div class="ladder">${r.levels
      .map((lv, i) => `<div class="rung ${i + 1 < L.level ? 'past' : i + 1 === L.level ? 'now' : ''}"><span class="n">${i + 1}</span><span><b>${esc(lv.name)}</b><span class="ml">${esc(lv.ml)}</span></span><span class="xp">${lv.at} XP</span></div>`)
      .join('')}</div>`),
  );
  $app.append(h(`<p class="foot-note">How to earn XP: reply (+10), reply with no fix (+5), say a fix out loud (+10), master a mistake (+25), hit your daily goal (+30), open the quest chest (+50).</p>`));
}

// ═══════════════════════════════════════════════════════════════
//  v3 — path-first app: welcome, learning path, tabs, lesson, rewards
// ═══════════════════════════════════════════════════════════════

/** The mascot: Base, a round green friend with a little coconut-leaf sprout. */
const mascot = (size = 'md', mood = '') =>
  `<span class="mascot m-${size} ${mood}" aria-hidden="true"><span class="m-leaf"><i></i><i></i></span><span class="m-body"><span class="eyes"><i></i><i></i></span><span class="cheeks"><i></i><i></i></span><span class="smile"></span></span></span>`;

const NODE_ICON = { phrases: () => I.book(30), lesson: () => I.mic(30), review: () => I.bolt(30), chest: () => I.chest(32), trophy: () => I.trophy(32) };

// ─── Bottom tab bar ──────────────────────────────────────────
const TABS = [
  ['#/', 'Story', () => I.book(24)],
  ['#/base', 'Base', () => I.chat(24)],
  ['#/phrases', 'Phrases', () => I.star(22)],
  ['#/progress', 'Me', () => I.user()],
];
function setTabbar(hash) {
  document.querySelector('.tabbar')?.remove();
  const tabHashes = TABS.map((t) => t[0]);
  const active = hash === '' || hash === '#' ? '#/' : hash;
  if (!tabHashes.includes(active) || (active === '#/' && state.welcome)) {
    document.body.classList.remove('has-tabs');
    return;
  }
  document.body.classList.add('has-tabs');
  const bar = h(`<nav class="tabbar" aria-label="Main">${TABS.map(
    ([href, label, icon]) => `<a href="${href}" class="tab ${href === active ? 'on' : ''}" ${href === active ? 'aria-current="page"' : ''}>${icon()}<span>${label}</span></a>`,
  ).join('')}</nav>`);
  bar.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => sfx.tap()));
  document.body.append(bar);
}

/** Top stats strip used on the tab screens. */
function statsBar() {
  const me = state.me;
  const s = me.stats;
  const el = h(`<header class="statsbar">
    <a class="brand" href="#/" aria-label="Home">${LOGO}</a>
    <span class="spacer"></span>
    ${me.user.daysToInterview !== null && me.user.daysToInterview >= 0 ? `<a class="stat-chip countdown" href="#/settings" aria-label="Interview in ${me.user.daysToInterview} days">${I.calendar(18)}<b>${me.user.daysToInterview === 0 ? 'Today' : `${me.user.daysToInterview}d`}</b></a>` : ''}
    <a class="stat-chip flame ${s.practicedToday ? 'lit' : ''}" href="#/progress" aria-label="${s.streak} day streak">${I.flame(20)}<b>${s.streak}</b></a>
    <a class="stat-chip xp" href="#/badges" aria-label="${me.level.xp} XP, level ${me.level.level}">${I.bolt(18)}<b>${me.level.xp}</b></a>
    ${me.freezes ? `<span class="stat-chip ice" title="Streak freezes saved">${I.snow(18)}<b>${me.freezes}</b></span>` : ''}
    ${me.user.isGuest ? `<a class="stat-chip login" href="#/login">Log in</a>` : ''}
  </header>`);
  return el;
}

// ─── Welcome (first visit) ───────────────────────────────────
function renderWelcome() {
  state.welcome = true;
  $app.innerHTML = '';
  const el = h(`<section class="welcome">
    <div class="w-sky"><span class="w-sun"></span><span class="w-wave w1"></span><span class="w-wave w2"></span></div>
    <div class="w-hero">${mascot('xl', 'wave')}<div class="w-bubble">Hi! I'm Base, your English mentor.<br/>Your career story starts today.</div></div>
    <h1 class="ml w-title">നല്ല ജോലിക്ക്<br/>നല്ല <span class="squiggle">English${SQUIGGLE}</span> പഠിക്കാം</h1>
    <ul class="w-points">
      <li>${I.book(18)}<span>Live your own job story — job fair, HR call, interview, first week</span></li>
      <li>${I.mic(18)}<span>Speak your way through it. I whisper the right English, explained in Malayalam</span></li>
      <li>${I.buoy(18)}<span class="ml">വാക്ക് കിട്ടിയില്ലെങ്കിൽ മലയാളത്തിൽ പറയാം</span></li>
    </ul>
    <div class="w-cta">
      <button class="b3d green block" data-start>Start my story</button>
      <a class="b3d ghost block" href="#/login">I already have an account</a>
    </div>
  </section>`);
  el.querySelector('[data-start]').addEventListener('click', () => {
    unlockAudio();
    sfx.tap();
    renderJobPicker(() => {
      state.skipWelcome = true;
      go('#/');
    });
  });
  $app.append(el);
}

/** One quick step: which job + experience (+ optional interview date). Skippable. */
function renderJobPicker(done, { title = 'What kind of job do you want?', cta = 'Continue' } = {}) {
  const u = state.me?.user || {};
  let role = u.targetRole || '';
  let exp = u.experience || '';
  const roles = state.meta?.roles || [];
  $app.innerHTML = '';
  const el = h(`<section class="picker">
    <div class="picker-head">${mascot('md', 'look')}<div class="w-bubble small">Your story will happen in <b>this</b> kind of job.</div></div>
    <h1>${esc(title)}</h1>
    <div class="role-grid" role="radiogroup" aria-label="Target job">${roles
      .map((r) => `<button type="button" role="radio" class="role-opt ${r.id === role ? 'on' : ''}" aria-checked="${r.id === role}" data-r="${r.id}"><b>${esc(r.label)}</b><span class="ml">${esc(r.ml)}</span></button>`)
      .join('')}</div>
    <h2>Your experience</h2>
    <div class="exp-row" role="radiogroup" aria-label="Experience">${(state.meta?.experienceLevels || [])
      .map((e) => `<button type="button" role="radio" class="chip ${e.id === exp ? 'on' : ''}" aria-checked="${e.id === exp}" data-e="${e.id}">${esc(e.label)}</button>`)
      .join('')}</div>
    <label class="lbl" for="idate">Got an interview coming up? <span class="small">(optional)</span></label>
    <input class="input" type="date" id="idate" value="${esc(u.interviewDate || '')}" />
    <label class="lbl" for="icomp">Company <span class="small">(optional)</span></label>
    <input class="input" id="icomp" value="${esc(u.company || '')}" placeholder="e.g. Infosys, Aster Hospitals" autocomplete="organization" />
    <div class="picker-foot">
      <button class="b3d green block" data-go ${role ? '' : 'disabled'}>${esc(cta)}</button>
      <button class="linkish" data-skip>Skip for now</button>
    </div>
  </section>`);
  const go2 = el.querySelector('[data-go]');
  el.querySelectorAll('[data-r]').forEach((b) =>
    b.addEventListener('click', () => {
      role = b.dataset.r;
      el.querySelectorAll('[data-r]').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
      go2.disabled = false;
      sfx.tap();
    }),
  );
  el.querySelectorAll('[data-e]').forEach((b) =>
    b.addEventListener('click', () => {
      exp = b.dataset.e;
      el.querySelectorAll('[data-e]').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
      sfx.tap();
    }),
  );
  go2.addEventListener('click', async () => {
    go2.disabled = true;
    await api('/profile', { method: 'POST', body: { targetRole: role, experience: exp, interviewDate: el.querySelector('#idate').value, company: el.querySelector('#icomp').value } }).catch(() => {});
    await loadMe().catch(() => {});
    done();
  });
  el.querySelector('[data-skip]').addEventListener('click', () => {
    state.skipWelcome = true;
    done();
  });
  $app.append(el);
}

// ─── Learn: the path ─────────────────────────────────────────
const ZIG = [0, 56, 84, 56, 0, -56, -84, -56];

function readinessRing(score, size = 76) {
  const r = size / 2 - 7;
  const C = 2 * Math.PI * r;
  return `<span class="r-ring" style="width:${size}px;height:${size}px" role="img" aria-label="Job-ready English ${score} percent">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="8"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#F2B33D" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - score / 100)}" stroke-opacity="${score ? 1 : 0}" transform="rotate(-90 ${size / 2} ${size / 2})" class="ring-arc"/></svg>
    <b>${score}<small>%</small></b></span>`;
}

function readinessCard(me) {
  const u = me.user;
  const d = u.daysToInterview;
  const when = d === null || d < 0 ? '' : d === 0 ? 'Interview <b>today</b> — you’ve got this!' : `Interview in <b>${d} day${d === 1 ? '' : 's'}</b>`;
  const el = h(`<a class="ready-card" href="#/progress">
    ${readinessRing(me.readiness?.score || 0)}
    <span class="rc-txt"><span class="rc-k">JOB-READY ENGLISH</span>
      <b>${u.targetRoleLabel ? `English for ${esc(u.targetRoleLabel)}` : 'Your job English'}</b>
      <span class="rc-s">${when || (u.targetRoleLabel ? 'Speak in every situation to reach 100%' : 'Tap to choose your kind of job')}</span></span>
  </a>`);
  if (!u.targetRoleLabel) {
    el.setAttribute('href', '#/job');
  }
  return el;
}

async function renderLearn() {
  state.welcome = false;
  if (!state.me) $app.innerHTML = `<div class="skel" aria-hidden="true"><div class="sk" style="height:44px"></div><div class="sk" style="height:96px;margin-top:20px;border-radius:24px"></div><div class="sk" style="height:84px;width:84px;border-radius:50%;margin:40px auto 0"></div></div>`;
  const [me, path] = await Promise.all([loadMe(), api('/path')]);
  const started = path.units.some((u) => u.nodes.some((n) => n.state === 'done'));
  if (me.user.isGuest && me.stats.sessionsDone === 0 && !started) return renderWelcome();
  $app.innerHTML = '';
  $app.append(statsBar());

  if (me.nudge) {
    const n = h(`<div class="nudge">${mascot('sm')}<div class="b"><div class="who">Base</div>${esc(me.nudge.text)}</div><button class="x" aria-label="Dismiss">${I.close(14)}</button></div>`);
    n.querySelector('.x').addEventListener('click', () => {
      api(`/nudges/${me.nudge.id}/read`, { method: 'POST' }).catch(() => {});
      n.remove();
    });
    $app.append(n);
  }

  $app.append(readinessCard(me));
  const wrap = h(`<div class="path"></div>`);
  let k = 0;
  for (const u of path.units) {
    const done = u.nodes.filter((n) => n.state === 'done').length;
    wrap.append(
      h(`<div class="unit-banner c-${u.color}">
        <div><div class="u-k">UNIT ${u.n}</div><div class="u-t">${esc(u.title)}</div><div class="u-ml ml">${esc(u.ml)}</div></div>
        <div class="u-prog" aria-label="${done} of ${u.nodes.length} done">${done}/${u.nodes.length}</div>
      </div>`),
    );
    const list = h(`<div class="nodes"></div>`);
    u.nodes.forEach((n) => {
      const x = ZIG[k++ % ZIG.length];
      const label = n.state === 'locked' ? `${n.title} (locked)` : n.title;
      const node = h(`<div class="node-row" style="--x:${x}px">
        <div class="node-wrap">
          ${n.state === 'current' ? `<div class="start-tip">${n.id === 'mock_full' ? 'MOCK INTERVIEW' : n.type === 'phrases' ? 'LEARN' : n.type === 'lesson' ? 'SPEAK' : n.type === 'review' ? 'REVIEW' : 'OPEN'}</div>` : ''}
          <button class="node t-${n.type} ${n.id === 'mock_full' ? 'boss' : ''} s-${n.state} c-${u.color}" aria-label="${esc(label)}" aria-expanded="false">
            ${n.state === 'done' && n.type === 'lesson' ? I.check(30) : n.state === 'locked' && n.type === 'lesson' ? I.lock(26) : n.id === 'mock_full' ? I.briefcase(32) : NODE_ICON[n.type]()}
            ${n.runs > 1 ? `<span class="runs">×${n.runs}</span>` : ''}
          </button>
          ${n.state === 'current' ? `<span class="node-mascot">${mascot('sm', 'look')}</span>` : ''}
        </div>
      </div>`);
      node.querySelector('.node').addEventListener('click', (e) => openNodeCard(e.currentTarget, n, u));
      list.append(node);
    });
    wrap.append(list);
  }
  wrap.append(h(`<div class="path-end">${mascot('md', 'cheer')}<p>Finished the path? Keep speaking in Practice — and rehearse your phrasebook before the big day.</p></div>`));
  $app.append(wrap);

  // Bring the current step into view.
  requestAnimationFrame(() => $app.querySelector('.node.s-current')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
}

function openNodeCard(btn, n, u) {
  document.querySelector('.node-card')?.remove();
  document.querySelectorAll('.node[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  sfx.tap();
  const locked = n.state === 'locked';
  const action =
    n.type === 'lesson'
      ? n.state === 'done'
        ? `Practise again · +${n.xp} XP`
        : `Start · +${n.xp} XP`
      : n.type === 'phrases'
        ? `${n.state === 'done' ? 'Learn again' : 'Start lesson'} · +${n.xp} XP`
        : n.type === 'review'
        ? `Start review · +${n.xp} XP`
        : `Open · +${n.xp} XP`;
  const card = h(`<div class="node-card c-${locked ? 'locked' : u.color}" role="dialog" aria-label="${esc(n.title)}">
    <div class="nc-t">${esc(n.title)}</div>
    <div class="nc-s">${locked ? 'Finish the steps above to unlock this.' : n.state === 'done' && !['lesson', 'phrases'].includes(n.type) ? 'Done!' : esc(n.subtitle)}${n.partner && !locked ? ` · Base plays: ${esc(n.partner)}` : ''}</div>
    ${locked || (n.state === 'done' && !['lesson', 'phrases'].includes(n.type)) ? '' : `<button class="b3d white block">${action}</button>`}
  </div>`);
  btn.setAttribute('aria-expanded', 'true');
  btn.closest('.node-row').after(card);
  card.querySelector('button')?.addEventListener('click', async () => {
    unlockAudio();
    if (n.type === 'lesson') return go(`#/talk/${n.id}`);
    if (n.type === 'phrases') return go(`#/learn/${n.id}`);
    if (n.type === 'review') return go(`#/warmup/${n.id}`);
    const r = await api(`/path/${n.id}/complete`, { method: 'POST' }).catch((e) => toast(e.message));
    if (r) {
      sfx.level();
      buzz([30, 50, 80]);
      celebrate(`+${r.gained} XP`, n.type === 'trophy' ? 'Unit complete! അഭിനന്ദനങ്ങൾ!' : 'സമ്മാനം!');
      setTimeout(renderLearn, 1200);
    }
  });
  const close = (e) => {
    if (!card.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      card.remove();
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', close, true);
    }
  };
  setTimeout(() => document.addEventListener('click', close, true));
}

// ─── Phrase lesson: listen → understand → say it ────────────
async function renderPhraseLesson(nodeId) {
  state.welcome = false;
  if (!state.me) await loadMe();
  const L = await api(`/phrases/${nodeId}`);
  state.cleanup = () => {
    document.querySelector('.fb-sheet')?.remove();
    recorder.release();
  };
  let i = 0;
  let firstTry = 0;
  const total = L.phrases.length;
  const show = () => {
    document.querySelector('.fb-sheet')?.remove();
    if (i >= total) return finish();
    const p = L.phrases[i];
    let attempts = 0;
    $app.innerHTML = '';
    const el = h(`<div class="lesson">
      <header class="l-head"><button class="l-x" aria-label="Leave lesson">${I.close(22)}</button>
        <div class="l-bar"><i style="width:${Math.max(4, Math.round((i / total) * 100))}%"></i></div><span class="ph-count">${i + 1}/${total}</span></header>
      <div class="l-body">
        <div class="l-role"><b>${esc(L.title)}</b>${I.book(14)} Listen, understand, then say it out loud</div>
        <div class="l-scene">${mascot('lg', 'talking')}<div class="l-bubble"><button class="l-say" aria-label="Listen again">${I.speaker(22)}</button><span class="ph-en">${esc(p.en)}</span></div></div>
        <div class="ph-card"><div class="ph-k">MEANING</div><div class="ph-ml ml">${esc(p.ml)}</div>${p.note ? `<div class="ph-note">${I.bulb(15)} ${esc(p.note)}</div>` : ''}</div>
        <div class="fb-result" aria-live="polite"></div>
      </div>
      <footer class="l-foot"><div class="l-hint">Tap the mic and say the sentence</div>
        <div class="l-microw"><span class="l-side"><button class="linkish" data-slow>Slower</button></span><button class="l-mic" aria-label="Say it">${MIC_SVG}<span class="ring"></span></button><span class="l-side" data-skipslot></span></div></footer>
    </div>`);
    $app.append(el);
    const masc = el.querySelector('.mascot');
    const play = (slow) => {
      masc.classList.add('talking');
      say(p.en, { slow }).then(() => masc.classList.remove('talking'));
    };
    el.querySelector('.l-x').addEventListener('click', () => go('#/'));
    el.querySelector('.l-say').addEventListener('click', () => play(false));
    el.querySelector('[data-slow]').addEventListener('click', () => play(true));
    play(false);
    const res = el.querySelector('.fb-result');
    const mic = el.querySelector('.l-mic');
    micControl(mic, {
      async onAudio(out) {
        sfx.send();
        mic.disabled = true;
        res.innerHTML = `<span class="small">Checking…</span>`;
        let r;
        try {
          r = await api('/retry', { method: 'POST', form: audioForm(out, { target: p.en, context: 'phrase' }) });
        } catch (e) {
          res.innerHTML = '';
          toast(e.message);
          mic.disabled = false;
          return;
        }
        attempts++;
        if (r.pass) {
          if (attempts === 1) firstTry++;
          res.innerHTML = '';
          sfx.success();
          buzz(20);
          masc.classList.add('cheer');
          if (r.rewards?.xp) floatXp(r.rewards.xp, mic);
          const sh = h(`<div class="fb-sheet good" role="dialog"><div class="fb-top"><span class="fb-ic">${I.check(26)}</span><div><div class="fb-title">${attempts === 1 ? 'Perfect!' : 'You got it!'}</div><div class="fb-sub">“${esc(r.transcript)}”</div></div></div><button class="b3d green block" data-next>Continue</button></div>`);
          document.body.append(sh);
          el.querySelector('.l-foot').classList.add('covered');
          sh.querySelector('[data-next]').addEventListener('click', () => {
            sfx.tap();
            i++;
            show();
          });
          sh.querySelector('[data-next]').focus();
        } else {
          sfx.soft();
          masc.classList.remove('talking');
          masc.classList.add('oops');
          setTimeout(() => masc.classList.remove('oops'), 1200);
          res.innerHTML = `<div class="fb-no shake">Almost! Listen once more and try again.${r.missing?.length ? ` Listen for: <b>${r.missing.map(esc).join(', ')}</b>` : ''}<span>We heard: “${esc(r.transcript)}”</span></div>`;
          mic.disabled = false;
          if (attempts >= 2 && !el.querySelector('[data-skip]')) {
            const sk = h(`<button class="linkish" data-skip>Skip</button>`);
            sk.addEventListener('click', () => {
              i++;
              show();
            });
            el.querySelector('[data-skipslot]').append(sk);
          }
        }
      },
    });
  };
  const finish = async () => {
    const r = await api(`/path/${nodeId}/complete`, { method: 'POST' }).catch(() => null);
    await loadMe().catch(() => {});
    $app.innerHTML = '';
    const el = h(`<section class="done-screen">
      <div class="burst">${mascot('xl', 'cheer')}</div>
      <h1 class="center">Lesson complete!</h1>
      <p class="center done-sub">You learned ${total} new sentences — ${firstTry} right on the first try. Now use them in a real conversation.</p>
      <div class="tiles"><div class="tile3 gold"><div class="t-k">XP</div><div class="t-v">${I.bolt(20)}<span>${r?.gained || 0}</span></div></div>
      <div class="tile3 green"><div class="t-k">SENTENCES</div><div class="t-v">${I.book(18)}<span>${total}</span></div></div>
      <div class="tile3 blue"><div class="t-k">FIRST TRY</div><div class="t-v">${I.target(18)}<span>${firstTry}/${total}</span></div></div></div>
      <a class="b3d white block" href="#/phrasebook">${I.book(18)} Open my phrasebook</a>
    </section>`);
    const foot = h(`<div class="done-foot"><button class="b3d green block">Continue</button></div>`);
    foot.querySelector('button').addEventListener('click', () => go('#/'));
    $app.append(el, foot);
    sfx.level();
    if (r?.gained) celebrate(`+${r.gained} XP`, 'പുതിയ വാചകങ്ങൾ പഠിച്ചു!');
  };
  show();
}

// ─── Phrasebook ──────────────────────────────────────────────
async function renderPhrasebook() {
  state.welcome = false;
  if (!state.me) await loadMe();
  const r = await api('/phrasebook');
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  $app.append(h(`<h1>Phrasebook</h1>`), h(`<p class="lead">Useful English for your job. Tap any sentence to hear it.</p>`));
  const speak1 = (b, t) => b.addEventListener('click', () => {
    unlockAudio();
    say(t, { slow: true });
  });
  if (r.learned.length) {
    const sec = h(`<section class="pb-sec"><h2>Learned in your conversations</h2></section>`);
    for (const p of r.learned) {
      const b = h(`<button class="pb-item">${I.speaker(18)}<span><b>${esc(p.en)}</b>${p.ml ? `<span class="ml">${esc(p.ml)}</span>` : ''}</span></button>`);
      speak1(b, p.en);
      sec.append(b);
    }
    $app.append(sec);
  }
  for (const l of r.lessons) {
    const sec = h(`<section class="pb-sec"><h2>${esc(l.title)}</h2></section>`);
    for (const p of l.phrases) {
      const b = h(`<button class="pb-item">${I.speaker(18)}<span><b>${esc(p.en)}</b><span class="ml">${esc(p.ml)}</span></span></button>`);
      speak1(b, p.en);
      sec.append(b);
    }
    $app.append(sec);
  }
  if (!r.learned.length && !r.lessons.length) $app.append(emptyState(I.book(36), 'Empty for now', 'Start your first lesson to fill your phrasebook.', `<a class="b3d green" href="#/">Start learning</a>`));
}

// ═══════════════════════════════════════════════════════════════
//  Career story: home, Base chat, phone calls, episode endings
// ═══════════════════════════════════════════════════════════════
const PHONE_SVG = (s = 24, fill = 'currentColor') =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>`;
const MAIL_SVG = (s = 22) => svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', { size: s });
const QUOTE_SVG = (s = 22) => svg('<path d="M7 8h4v6H5v-2a4 4 0 0 1 2-4zM15 8h4v6h-6v-2a4 4 0 0 1 2-4z"/>', { size: s });

async function loadStory() {
  state.story = await api('/story');
  return state.story;
}
const allEpisodes = () => (state.story?.chapters || []).flatMap((c) => c.episodes);

function careerTrack(st, { small = false } = {}) {
  const n = st.stages.length;
  const pct = (st.stage / (n - 1)) * 84;
  return `<div class="track ${small ? 'sm' : ''}" role="img" aria-label="Career progress: ${esc(st.stages[st.stage])}">
    <span class="tr-line"></span><span class="tr-fill" style="width:${pct}%"></span>
    ${st.stages.map((label, i) => `<span class="tr-step ${i < st.stage ? 'done' : i === st.stage ? 'now' : ''}"><i>${i < st.stage ? I.check(11) : ''}</i><b>${esc(label)}</b></span>`).join('')}
  </div>`;
}

function outcomeCard(o) {
  const icon = o.kind === 'mail' ? MAIL_SVG() : o.kind === 'whatsapp' ? I.chat(22) : QUOTE_SVG();
  const label = o.kind === 'mail' ? 'Mail · now' : o.kind === 'whatsapp' ? 'WhatsApp · now' : 'Just now';
  return `<div class="notif k-${o.kind}"><span class="nf-ic">${icon}</span><span class="nf-body"><span class="nf-k">${label}</span><b>${esc(o.from)}${o.subject ? `: ${esc(o.subject)}` : ''}</b><span class="nf-t">${esc(o.text)}</span></span></div>`;
}

// ─── Story home ──────────────────────────────────────────────
async function renderStory() {
  state.welcome = false;
  if (!state.me) $app.innerHTML = `<div class="skel" aria-hidden="true"><div class="sk" style="height:44px"></div><div class="sk" style="height:40px;margin-top:18px"></div><div class="sk" style="height:260px;margin-top:18px;border-radius:28px"></div></div>`;
  const [me, st] = await Promise.all([loadMe(), loadStory()]);
  if (me.user.isGuest && me.stats.sessionsDone === 0 && st.doneCount === 0 && !me.user.targetRole && !state.skipWelcome) return renderWelcome();
  $app.innerHTML = '';
  const s = me.stats;
  const chapter = st.chapters.find((c) => c.episodes.some((e) => e.id === st.current?.id)) || st.chapters[st.chapters.length - 1];
  $app.append(
    h(`<header class="story-head">
      <div><div class="sh-k">${me.user.name ? `${esc(me.user.name.split(' ')[0].toUpperCase())}'S` : 'YOUR'} CAREER STORY</div><div class="sh-t">Chapter ${chapter.n} · ${esc(chapter.title)}</div></div>
      <a class="stat-chip flame ${s.practicedToday ? 'lit' : ''}" href="#/progress" aria-label="${s.streak} day streak">${I.flame(18)}<b>${s.streak}</b></a>
      ${me.user.isGuest ? `<a class="stat-chip login" href="#/login">Log in</a>` : ''}
    </header>`),
  );
  $app.append(h(careerTrack(st)));

  const cur = st.current;
  if (st.finished) {
    $app.append(h(`<div class="ep-card done"><div class="ep-k">STORY COMPLETE</div><div class="ep-t">You got the job — and nailed your first week.</div><div class="ep-s">New chapters are coming. Keep chatting with Base and replay any episode to stay sharp.</div><a class="b3d gold block" href="#/base">Chat with Base</a></div>`));
  } else if (cur.state === 'tomorrow') {
    $app.append(
      h(`<div class="ep-card locked">
        <span class="ep-ic">${I.lock(26)}</span>
        <div class="ep-k">EPISODE ${cur.n} · UNLOCKS TOMORROW</div>
        <div class="ep-t">${esc(cur.title)}</div>
        <div class="ep-s">${esc(cur.setup)}</div>
        <div class="ep-s small2">You've done ${st.newToday} new episodes today — great work. Base will message you in the morning.</div>
        <a class="b3d green block" href="#/base">${I.chat(20)} Chat with Base meanwhile</a>
      </div>`),
    );
  } else {
    const card = h(`<div class="ep-card">
      <span class="ep-glow"></span>
      <span class="ep-ic">${cur.mode === 'call' ? PHONE_SVG(28, '#F2B33D') : I.mic(28)}</span>
      <div class="ep-k">EPISODE ${cur.n} · TODAY</div>
      <div class="ep-t">${esc(cur.title)}</div>
      <div class="ep-s">${esc(cur.setup)}</div>
      <div class="ep-tags"><span>${cur.mode === 'call' ? 'Phone call' : 'Conversation'} · ~5 min</span>${cur.prep ? '<span>+ 5 new phrases</span>' : ''}</div>
      <button class="b3d green block" data-start>${I.play(18)} Start episode</button>
      ${cur.prep ? `<a class="ep-prep" href="#/learn/${cur.prep}">Prep with Base first · 5 useful phrases</a>` : ''}
    </div>`);
    card.querySelector('[data-start]').addEventListener('click', () => {
      unlockAudio();
      sfx.tap();
      startEpisode(cur);
    });
    $app.append(card);
  }

  const base = st.mentor;
  $app.append(
    h(`<a class="base-strip" href="#/base">${mascot('sm')}${base?.unread !== false ? '<span class="dot-unread"></span>' : ''}
      <span class="bs-body"><b>Base</b><span class="bs-t">${esc(base?.text || 'Tap to say hi — practise anything with me, any time.')}</span></span>${I.chev(20)}</a>`),
  );

  $app.append(
    h(`<div class="mini-stats">
      <div><b>${s.minutesSpoken}</b><span>min of English spoken</span></div>
      <div><b>${me.readiness?.score || 0}<small>%</small></b><span>job-ready English</span></div>
      <div><b>${st.doneCount}/${st.total}</b><span>episodes</span></div>
    </div>`),
  );

  for (const c of st.chapters) {
    const sec = h(`<section class="ch-sec"><h2>Chapter ${c.n} · ${esc(c.title)}<span class="ml">${esc(c.ml)}</span></h2></section>`);
    for (const e of c.episodes) {
      const locked = e.state === 'locked' || e.state === 'tomorrow';
      const row = h(`<button class="ep-row s-${e.state}" ${locked ? 'disabled' : ''}>
        <span class="er-ic">${e.state === 'done' ? I.check(16) : locked ? I.lock(15) : e.mode === 'call' ? PHONE_SVG(16) : I.mic(16)}</span>
        <span class="er-t"><b>${e.n}. ${esc(e.title)}</b><span>${e.state === 'done' ? 'Replay' : e.state === 'tomorrow' ? 'Unlocks tomorrow' : locked ? 'Locked' : 'Up next'}${e.mode === 'call' ? ' · phone call' : ''}</span></span>
        ${locked ? '' : I.chev(18)}
      </button>`);
      if (!locked) row.addEventListener('click', () => startEpisode(e));
      sec.append(row);
    }
    $app.append(sec);
  }
}

function startEpisode(ep) {
  state.episode = ep;
  if (ep.mode === 'call') go(`#/call/${ep.id}`);
  else go(`#/talk/${ep.id}`);
}

// ─── Incoming call ───────────────────────────────────────────
let ringTimer = null;
function ring(on) {
  clearInterval(ringTimer);
  if (!on) return;
  const r = () => {
    sfx.ring?.();
    buzz([400, 200, 400]);
  };
  r();
  ringTimer = setInterval(r, 2400);
}

async function renderIncoming(id) {
  state.welcome = false;
  if (!state.story) await loadStory();
  const ep = allEpisodes().find((e) => e.id === id);
  if (!ep) return go('#/');
  state.episode = ep;
  $app.innerHTML = '';
  const el = h(`<section class="incoming">
    <div class="ic-k">EPISODE ${ep.n} · ${esc(ep.title.toUpperCase())}</div>
    <div class="ic-av"><span class="ring1"></span><span class="ring2"></span><span class="ic-init">${esc((ep.caller || '?').charAt(0))}</span></div>
    <div class="ic-name">${esc(ep.caller)}</div>
    <div class="ic-role">${esc(ep.callerRole || '')}</div>
    <div class="ic-state"><i></i>Incoming call…</div>
    <div class="ic-tip">${mascot('xs')}<span><b>Base:</b> ${esc(ep.setup)}</span></div>
    <div class="ic-actions">
      <span><button class="ic-btn decline" aria-label="Not now">${PHONE_SVG(30, '#fff')}</button><small>Not now</small></span>
      <span><button class="ic-btn accept" aria-label="Answer the call">${PHONE_SVG(34, '#fff')}</button><small>Answer</small></span>
    </div>
  </section>`);
  $app.append(el);
  state.cleanup = () => ring(false);
  setTimeout(() => ring(true), 400);
  el.querySelector('.decline').addEventListener('click', () => {
    ring(false);
    go('#/');
  });
  el.querySelector('.accept').addEventListener('click', () => {
    ring(false);
    unlockAudio();
    state.callAnswered = id;
    go(`#/talk/${id}`);
  });
}

// ─── Base: the WhatsApp-style mentor chat ────────────────────
async function renderChat() {
  state.welcome = false;
  if (!state.me) await loadMe();
  const r = await api('/chat');
  $app.innerHTML = '';
  const wrap = h(`<div class="chat">
    <header class="chat-head">${mascot('sm')}<div><b>Base</b><span>your English mentor · online</span></div></header>
    <div class="chat-thread" aria-live="polite"><div class="day-pill">TODAY</div></div>
    <div class="chat-compose">
      <form class="cc-form"><input placeholder="Type, or tap the mic to talk" aria-label="Message Base" autocomplete="off" /></form>
      <button class="cc-mic" aria-label="Record a voice note">${I.mic(24)}<span class="ring"></span></button>
    </div>
  </div>`);
  $app.append(wrap);
  const thread = wrap.querySelector('.chat-thread');
  const scroll = () => requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  if (r.locked) {
    thread.append(h(`<div class="msg base">${r.locked === 'login' ? 'Log in to keep chatting with me — your progress is saved to your number.' : r.locked === 'daily_limit' ? "That's enough practice for today! Let's talk again tomorrow." : 'Your free sessions are used up. Get the monthly pass to keep practising with me.'}<a class="b3d green" style="margin-top:10px" href="${r.locked === 'login' ? '#/login' : r.locked === 'daily_limit' ? '#/' : '#/upgrade'}">${r.locked === 'login' ? 'Log in' : r.locked === 'daily_limit' ? 'Back to my story' : 'See the monthly pass'}</a></div>`));
    wrap.querySelector('.chat-compose').remove();
    return;
  }
  const sid = r.session.id;
  const time = () => new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const baseMsg = (text, { autoplay = false } = {}) => {
    const m = h(`<div class="msg base"><button class="vn-play" aria-label="Play voice note">${I.play(14)}</button><span class="vn-wave">${'<i></i>'.repeat(14)}</span><div class="m-t">${esc(text)}</div><span class="m-time">${time()}</span></div>`);
    const play = () => {
      m.classList.add('playing');
      say(text).then(() => m.classList.remove('playing'));
    };
    m.querySelector('.vn-play').addEventListener('click', () => {
      unlockAudio();
      play();
    });
    thread.append(m);
    if (autoplay) play();
    return m;
  };
  const meMsg = (html) => {
    const m = h(`<div class="msg me"><div class="m-t">${html}</div><span class="m-time">${time()}</span></div>`);
    thread.append(m);
    return m;
  };
  for (const m of r.messages) {
    if (m.role === 'partner') baseMsg(m.text);
    else meMsg(markMl(m.text));
  }
  const quick = () => {
    thread.querySelector('.quick')?.remove();
    const cur = state.story?.current;
    const q = h(`<div class="quick">${cur && cur.state === 'current' ? `<button data-ep>${cur.mode === 'call' ? 'Take the call' : 'Start my episode'}</button>` : ''}<button data-q>Practise a question</button></div>`);
    q.querySelector('[data-ep]')?.addEventListener('click', () => startEpisode(cur));
    q.querySelector('[data-q]').addEventListener('click', () => go('#/questions'));
    thread.append(q);
  };
  if (!state.story) await loadStory().catch(() => {});
  quick();
  scroll();

  let busy = false;
  async function send(form, pendingHtml) {
    if (busy) return;
    busy = true;
    thread.querySelector('.quick')?.remove();
    const mine = meMsg(pendingHtml);
    const typing = h(`<div class="msg base typing"><span class="dots"><span></span><span></span><span></span></span></div>`);
    thread.append(typing);
    scroll();
    let t;
    try {
      t = await api(`/sessions/${sid}/turn`, { method: 'POST', form });
    } catch (e) {
      typing.remove();
      mine.remove();
      toast(e.message);
      busy = false;
      return;
    }
    typing.remove();
    let html = markMl(t.transcript);
    if (t.correction?.youSaid && t.transcript.includes(t.correction.youSaid) && t.correction.youSaid.length < t.transcript.length) {
      html = markMl(t.transcript).replace(esc(t.correction.youSaid), `<mark>${esc(t.correction.youSaid)}</mark>`);
    } else if (t.correction) html = `<mark>${markMl(t.transcript)}</mark>`;
    mine.querySelector('.m-t').innerHTML = html;
    handleRewards(t.rewards, mine);
    if (t.correction) await fixCard(t.correction);
    else if (t.coaching?.phrase) thread.append(h(`<div class="phrase-chip">${I.book(14)} New phrase: <b>${esc(t.coaching.phrase)}</b></div>`));
    baseMsg(t.reply, { autoplay: true });
    quick();
    scroll();
    busy = false;
  }

  function fixCard(c) {
    return new Promise((resolve) => {
      const card = h(`<div class="fix-inline">
        <div class="fi-k">ONE SMALL FIX</div>
        <div class="fi-right"><button class="fb-say sm" aria-label="Hear it">${I.speaker(16)}</button>“${esc(c.sayItLikeThis)}”</div>
        <div class="fi-why ml">${esc(c.explanationMl)}</div>
        <div class="fi-act"><button class="fi-mic">${I.mic(16)} <span>Say it again</span></button><button class="linkish" data-later>Later</button></div>
        <div class="fi-res" aria-live="polite"></div>
      </div>`);
      thread.append(card);
      scroll();
      card.querySelector('.fb-say').addEventListener('click', () => say(c.sayItLikeThis, { slow: true }));
      say(c.sayItLikeThis, { slow: true });
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        card.querySelector('.fi-act')?.remove();
        resolve();
      };
      card.querySelector('[data-later]').addEventListener('click', () => {
        track('retry_skipped', { attempts: 0, where: 'chat' }, sid);
        finish();
      });
      const btn = card.querySelector('.fi-mic');
      micControl(btn, {
        icon: `${I.mic(16)} <span>Say it again</span>`,
        stopIcon: `<span class="stopsq sm"></span> <span>Done</span>`,
        async onAudio(out) {
          btn.disabled = true;
          const rr = await api('/retry', { method: 'POST', form: audioForm(out, { target: c.sayItLikeThis, mistakeId: c.mistakeId, context: 'session', sessionId: sid }) }).catch((e) => toast(e.message));
          btn.disabled = false;
          if (!rr) return;
          if (rr.pass) {
            sfx.success();
            handleRewards(rr.rewards, card);
            card.classList.add('ok');
            card.querySelector('.fi-res').innerHTML = `${I.check(14)} Perfect!`;
            finish();
          } else {
            sfx.soft();
            card.querySelector('.fi-res').innerHTML = `Almost — try once more. We heard: “${esc(rr.transcript)}”`;
          }
        },
      });
    });
  }

  const mic = wrap.querySelector('.cc-mic');
  micControl(mic, {
    icon: `${I.mic(24)}`,
    stopIcon: `<span class="stopsq"></span>`,
    onAudio(out) {
      sfx.send();
      send(audioForm(out), `<span class="wave"><i></i><i></i><i></i><i></i><i></i></span>`);
    },
  });
  const form = wrap.querySelector('.cc-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = form.querySelector('input').value.trim();
    if (!v) return;
    form.querySelector('input').value = '';
    const f = new FormData();
    f.append('text', v);
    send(f, esc(v));
  });
  state.cleanup = () => recorder.release();
}

// ─── Phrases tab ─────────────────────────────────────────────
async function renderPhrasesTab() {
  await renderPhrasebook();
  const head = $app.querySelector('.topbar');
  head?.replaceWith(statsBar());
  const links = h(`<div class="pt-links">
    <a class="big-card white" href="#/questions"><span class="bc-ic" style="background:var(--sky-l);color:var(--sky-d)">${I.chat(24)}</span><span><b>Speaking practice</b><span>Answer any single question out loud</span></span><span class="go">${I.chev(20)}</span></a>
    <a class="big-card white" href="#/answers"><span class="bc-ic" style="background:var(--gold-soft);color:var(--gold-ink)">${I.star(22)}</span><span><b>My best answers</b><span>Your answers in natural English</span></span><span class="go">${I.chev(20)}</span></a>
    <a class="big-card gold" href="#/warmup"><span class="bc-ic">${I.bolt(24)}</span><span><b>Fix my mistakes</b><span>2-minute warm-up · <a href="#/bank" style="color:inherit">Mistake Bank</a></span></span><span class="go">${I.chev(20)}</span></a>
  </div>`);
  $app.querySelector('h1')?.after(links);
}

// ─── Episode ending + milestones (part of the lesson-complete sequence) ──
function storyScreen(r) {
  const s = r.story;
  const seenW = new Set();
  r = { ...r, words: r.words.filter((w) => !seenW.has(w.english.toLowerCase()) && seenW.add(w.english.toLowerCase())) };
  const st = state.story;
  const el = h(`<section class="done-screen story-end">
    ${outcomeCard(s.outcome)}
    <div class="se-head"><div class="se-k">EPISODE ${s.episode.n} COMPLETE</div><h1>${esc(s.headline)}</h1></div>
    ${st ? careerTrack({ ...st, stage: s.milestone === 'offer' ? 4 : Math.min(st.stages.length - 1, Math.max(s.episode.stage, s.next ? s.next.stage : s.episode.stage)) }, { small: true }) : ''}
    <div class="learned">
      <div class="ld-head"><b>What you learned</b><span>+${r.xp || 0} XP</span></div>
      ${r.mistakes.map((m) => `<div class="ld-row"><span class="tick">${I.check()}</span><span>${esc(m.corrected)}</span></div>`).join('') || '<div class="ld-row"><span class="tick">' + I.check() + '</span><span>Clear English all the way — no fixes needed!</span></div>'}
      ${r.words.length ? `<div class="ld-words">${r.words.slice(0, 3).map((w) => `<span class="word-chip"><span class="ml">${esc(w.said)}</span> → <b>${esc(w.english)}</b></span>`).join('')}</div>` : ''}
    </div>
    ${s.next ? `<div class="next-ep"><span class="ne-ic">${I.lock(22)}</span><span><span class="ne-k">NEXT · EPISODE ${s.next.n}</span><b>${esc(s.next.title)}</b><span class="ne-s">${esc(s.episode.teaser)}</span></span></div>` : ''}
  </section>`);
  setTimeout(() => {
    sfx.level();
    buzz([30, 40, 60]);
  }, 250);
  return el;
}

function milestoneScreen(r) {
  const s = r.story;
  const isOffer = s.milestone === 'offer';
  const el = h(`<section class="done-screen milestone">
    <div class="ms-k">${isOffer ? 'CHAPTER 3 COMPLETE' : 'CHAPTER 4 COMPLETE'}</div>
    <h1 class="center">${isOffer ? 'You got the offer!' : 'Welcome to the team!'}</h1>
    <div class="letter"><span class="lt-seal">${I.star(28)}</span>
      <div class="lt-co">${esc(s.company.toUpperCase())}</div><div class="kasavu"></div>
      <p>${esc(s.outcome.text)}</p>
    </div>
    <p class="center ml done-sub">${isOffer ? 'ഇനി അടുത്ത അധ്യായം — പുതിയ ജോലിയിലെ ആദ്യ ആഴ്ച!' : 'ആദ്യ ആഴ്ച വിജയകരമായി പൂർത്തിയാക്കി!'}</p>
  </section>`);
  setTimeout(() => {
    sfx.level();
    celebrate(isOffer ? 'Offer letter!' : 'First week done!', 'അഭിനന്ദനങ്ങൾ!');
  }, 300);
  return el;
}

// ─── Practice tab ────────────────────────────────────────────
async function renderPractice() {
  state.welcome = false;
  const [me, path] = await Promise.all([loadMe(), api('/path')]);
  $app.innerHTML = '';
  $app.append(statsBar());
  $app.append(h(`<h1>Practice</h1>`));
  const mockUnlocked = path.units.flatMap((u) => u.nodes).find((n) => n.id === 'mock_full')?.state !== 'locked';
  const mock = h(`<button class="big-card mock ${mockUnlocked ? '' : 'locked'}"><span class="bc-ic">${I.briefcase(28)}</span><span><b>Full mock interview</b><span>${mockUnlocked ? 'Use all your English in one 10-minute interview' : 'Unlocks in Unit 4 — practise single questions below meanwhile'}</span></span><span class="go">${mockUnlocked ? I.chev(22) : I.lock(20)}</span></button>`);
  if (mockUnlocked) mock.addEventListener('click', () => go('#/talk/mock_full'));
  $app.append(mock);
  $app.append(
    h(`<a class="big-card white" href="#/questions"><span class="bc-ic" style="background:var(--sky-l);color:var(--sky-d)">${I.chat(26)}</span><span><b>Speaking practice</b><span>Answer one question out loud — interviews, HR calls, work${me.user.targetRoleLabel ? ` · ${esc(me.user.targetRoleLabel)}` : ''}</span></span><span class="go">${I.chev(22)}</span></a>`),
  );
  $app.append(
    h(`<a class="big-card white" href="#/phrasebook"><span class="bc-ic" style="background:var(--leaf-l);color:var(--leaf-d)">${I.book(26)}</span><span><b>Phrasebook</b><span>Every useful sentence you've learned, with Malayalam meaning</span></span><span class="go">${I.chev(22)}</span></a>`),
  );
  $app.append(
    h(`<a class="big-card white" href="#/answers"><span class="bc-ic" style="background:var(--gold-soft);color:var(--gold-ink)">${I.star(24)}</span><span><b>My best answers</b><span>Your answers in natural English — say them until they feel easy</span></span><span class="go">${I.chev(22)}</span></a>`),
  );
  $app.append(h(`<h2>Fix your mistakes</h2>`));
  const pending = me.warmup.pending;
  $app.append(
    h(`<a class="big-card gold" href="#/warmup"><span class="bc-ic">${I.bolt(28)}</span><span><b>2-minute warm-up</b><span>${pending ? `${pending} of your own English mistakes` : 'No mistakes yet — answer a few questions first'}</span></span><span class="go">${I.chev(22)}</span></a>`),
  );
  $app.append(
    h(`<a class="big-card white" href="#/bank"><span class="bc-ic" style="background:var(--green-soft);color:var(--green)">${I.book(26)}</span><span><b>Mistake Bank</b><span>${me.stats.mistakesTotal - me.stats.mistakesMastered} to practise · ${me.stats.mistakesMastered} mastered</span></span><span class="go">${I.chev(22)}</span></a>`),
  );
  $app.append(h(`<h2>Replay a conversation</h2>`));
  const grid = h(`<div class="free-grid"></div>`);
  for (const u of path.units) {
    for (const n of u.nodes.filter((x) => x.type === 'lesson' && x.id !== 'mock_full')) {
      const locked = n.state === 'locked';
      const t = h(`<button class="free c-${u.color} ${locked ? 'locked' : ''}" ${locked ? 'disabled' : ''}><span class="f-ic">${locked ? I.lock(20) : I.mic(22)}</span><b>${esc(n.title)}</b><span>${esc(n.partner)}</span></button>`);
      if (!locked) t.addEventListener('click', () => go(`#/talk/${n.id}`));
      grid.append(t);
    }
  }
  $app.append(grid);
}

// ─── Question bank: drill one question ───────────────────────
async function renderQuestions() {
  state.welcome = false;
  if (!state.me) await loadMe();
  const r = await api('/questions');
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  $app.append(h(`<h1>Speaking practice</h1>`));
  $app.append(h(`<p class="lead">Pick a question and answer it out loud. You'll get one English fix, a useful phrase and the natural way to say it.</p>`));
  if (!state.me.user.targetRoleLabel) $app.append(h(`<a class="small" href="#/job" style="display:block;margin:-8px 0 14px">Choose your kind of job for job-specific questions →</a>`));
  for (const a of r.areas) {
    const ready = r.readiness.areas.find((x) => x.area === a.id)?.pct || 0;
    const sec = h(`<section class="q-area"><div class="qa-head"><span><b>${esc(a.label)}</b><span class="ml">${esc(a.ml)}</span></span><span class="qa-pct">${ready}%</span></div></section>`);
    for (const q of a.questions) {
      const b = h(`<button class="q-item">${I.mic(18)}<span>${esc(q)}</span>${I.chev(18)}</button>`);
      b.addEventListener('click', () => {
        unlockAudio();
        state.drillQuestion = q;
        go('#/talk/drill');
      });
      sec.append(b);
    }
    $app.append(sec);
  }
}

// ─── My answers: rehearse your best answers ──────────────────
async function renderAnswers() {
  state.welcome = false;
  if (!state.me) await loadMe();
  const r = await api('/answers');
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  $app.append(h(`<h1>My best answers</h1>`));
  $app.append(h(`<p class="lead">Your own answers, said in natural English. Listen, then say them out loud until they feel easy — perfect before an interview.</p>`));
  if (!r.answers.length) {
    $app.append(emptyState(I.star(36), 'No answers yet', 'Have a few conversations and your answers in natural English will appear here.', `<a class="b3d green" href="#/">Start practising</a>`));
    return;
  }
  state.cleanup = () => recorder.release();
  for (const a of r.answers) {
    const area = (state.meta?.areas || []).find((x) => x.id === a.area);
    const card = h(`<div class="ans-card">
      <div class="ans-k">${esc(area?.label || a.area)} ${a.rehearsed ? `<span class="badge done">REHEARSED ×${a.rehearsed}</span>` : ''}</div>
      <div class="ans-q">“${esc(a.question)}”</div>
      <div class="ans-p">${esc(a.polished)}</div>
      <details class="ans-orig"><summary>What you first said</summary><p>${esc(a.answer)}</p></details>
      <div class="ans-act">
        <button class="b3d white" data-listen>${I.speaker(18)} Listen</button>
        <button class="b3d gold" data-say>${I.mic(18)} <span>Say it</span></button>
      </div>
      <div class="ans-res" aria-live="polite"></div>
    </div>`);
    card.querySelector('[data-listen]').addEventListener('click', () => {
      unlockAudio();
      say(a.polished, { slow: true });
    });
    const res = card.querySelector('.ans-res');
    const btn = card.querySelector('[data-say]');
    micControl(btn, {
      icon: `${I.mic(18)} <span>Say it</span>`,
      stopIcon: `<span class="stopsq sm"></span> <span>Done</span>`,
      async onAudio(out) {
        btn.disabled = true;
        res.innerHTML = `<span class="small">Checking…</span>`;
        try {
          const rr = await api('/retry', { method: 'POST', form: audioForm(out, { target: a.polished, answerId: a.id, context: 'answer' }) });
          if (rr.pass) {
            sfx.success();
            celebrate('Sounding confident!', 'ആത്മവിശ്വാസത്തോടെ!');
            res.innerHTML = `<div class="retry-result ok">${I.check(18)} Great delivery. Say it again tomorrow so it sticks.</div>`;
          } else {
            sfx.soft();
            res.innerHTML = `<div class="fb-no">Nearly — you missed a few parts. Listen once more and try again.${rr.missing?.length ? ` Missing: <b>${rr.missing.map(esc).join(', ')}</b>` : ''}</div>`;
          }
        } catch (e) {
          res.innerHTML = '';
          toast(e.message);
        }
        btn.disabled = false;
      },
    });
    $app.append(card);
  }
}

// ─── Progress tab ────────────────────────────────────────────
async function renderProgress() {
  state.welcome = false;
  const me = await loadMe();
  const s = me.stats;
  $app.innerHTML = '';
  $app.append(statsBar());
  $app.append(h(`<div class="me-head"><h1>Me</h1>${me.user.isGuest ? `<a class="b3d white" href="#/login">Log in</a>` : `<a class="b3d white" href="#/settings">${I.user(18)} Settings</a>`}</div>`));
  const R = me.readiness || { score: 0, areas: [] };
  const d = me.user.daysToInterview;
  $app.append(
    h(`<div class="ready-big">
      <div class="rb-top">${readinessRing(R.score, 96)}<div><div class="rc-k">JOB-READY ENGLISH</div><b>${R.score >= 80 ? 'Ready for the job!' : R.score >= 50 ? 'Getting there' : 'Building up'}</b>
      <div class="rc-s">${d !== null && d >= 0 ? (d === 0 ? 'Interview today — good luck!' : `Interview in ${d} day${d === 1 ? '' : 's'}`) : 'How clearly you speak in each job situation'}</div></div></div>
      <div class="areas">${R.areas
        .map((x) => {
          const a = (state.meta?.areas || []).find((y) => y.id === x.area);
          return `<div class="ar"><span class="ar-l">${esc(a?.label || x.area)}</span><span class="ar-bar"><i style="width:${x.pct}%"></i></span><span class="ar-p">${x.answers ? x.pct + '%' : '—'}</span></div>`;
        })
        .join('')}</div>
      <a class="b3d white block" href="#/questions" style="margin-top:12px">Practise your weakest situation</a>
    </div>`),
  );
  const L = me.level;
  $app.append(
    h(`<a class="level-card" href="#/badges" style="margin-top:14px"><span class="lv-badge">${L.level}</span><span class="lv-txt"><b>${esc(L.name)}</b><span class="ml" style="font-size:13px;opacity:.85">${esc(L.ml)}</span><span class="lv-bar"><i style="width:${Math.round(L.progress * 100)}%"></i></span><span class="lv-sub">${L.next ? `${L.next - L.xp} XP to level ${L.level + 1}` : 'Top level!'} · see badges</span></span></a>`),
  );
  const week = s.week
    .map((d2, i) => `<div class="d ${i === s.week.length - 1 ? 'today' : ''}"><div class="bar ${d2.practiced ? 'on' : ''}"></div>${new Date(d2.day + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'narrow' })}</div>`)
    .join('');
  $app.append(
    h(`<div class="streak-card" style="margin-top:14px"><div class="streak-top"><span style="color:var(--gold)">${I.flame(34)}</span><span class="n">${s.streak}</span><span class="l">day streak</span><span class="side">${goalRing(s.secondsToday, me.user.dailyGoalMin || 5)}<span class="goal-l">today's goal</span></span></div><div class="week">${week}</div></div>`),
  );
  if (me.quests) $app.append(questCard(me.quests));
  const ins = me.insights;
  if (ins && ins.replies) {
    $app.append(h(`<h2>Your speaking this week</h2>`));
    $app.append(
      h(`<div class="insights">
        <div class="ins"><div class="v">${ins.wordsPerReply}</div><div class="l">words per answer</div>${trendLine(ins.wordsPerReply, ins.wordsPerReplyPrev, '')}<div class="hint">Longer answers = more confidence</div></div>
        <div class="ins"><div class="v">${ins.cleanReplyRate}<small>%</small></div><div class="l">answers with no English fix</div><div class="hint">${ins.replies} answers this week</div></div>
        <div class="ins"><div class="v">${ins.lifelineWords}</div><div class="l">Malayalam words used</div>${trendLine(ins.lifelineWords, ins.lifelineWordsPrev, '', true)}<div class="hint">Fewer over time = growing vocabulary</div></div>
        <div class="ins"><div class="v">${s.minutesSpoken}</div><div class="l">minutes of English spoken</div><div class="hint">${s.daysPracticed} days practised</div></div>
      </div>`),
    );
  }
  if (!me.user.isGuest) {
    $app.append(
      h(`<a class="big-card white" href="#/invite" style="margin-top:14px"><span class="bc-ic" style="background:var(--gold-soft);color:var(--gold-ink)">${I.gift()}</span><span><b>Learn with a friend</b><span>Invite someone looking for a job — you both get free sessions</span></span><span class="go">${I.chev(22)}</span></a>`),
    );
  }
}

// ─── Lesson: one exchange at a time ──────────────────────────
async function renderTalk(scenarioId) {
  state.welcome = false;
  if (!state.me) await loadMe();
  $app.innerHTML = '';
  const L = h(`<div class="lesson">
    <header class="l-head">
      <button class="l-x" data-exit aria-label="Leave lesson">${I.close(22)}</button>
      <div class="l-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i style="width:4%"></i></div>
      <span class="l-combo" hidden></span>
      <button class="l-hf" data-hf aria-pressed="false" aria-label="Hands-free mode" title="Hands-free mode">${I.headset(20)}</button>
    </header>
    <div class="l-body">
      <div class="l-role"></div>
      <div class="l-scene">
        ${mascot('lg')}
        <div class="l-bubble"><button class="l-say" aria-label="Hear it again">${I.speaker(22)}</button><span class="l-text"><span class="dots"><span></span><span></span><span></span></span></span></div>
      </div>
      <div class="l-answer" hidden></div>
    </div>
    <footer class="l-foot">
      <div class="l-hint" aria-live="polite">Getting ready…</div>
      <div class="l-microw"><span class="l-side" data-left></span><button class="l-mic" disabled aria-label="Tap to speak">${MIC_SVG}<span class="ring"></span></button><span class="l-side" data-right></span></div>
      <button class="linkish" data-type>Can't talk right now? Type instead</button>
      <div data-typeslot></div>
    </footer>
  </div>`);
  $app.append(L);
  const bar = L.querySelector('.l-bar');
  const comboEl = L.querySelector('.l-combo');
  const roleEl = L.querySelector('.l-role');
  const masc = L.querySelector('.mascot');
  const textEl = L.querySelector('.l-text');
  const answer = L.querySelector('.l-answer');
  const hint = L.querySelector('.l-hint');
  const micBtn = L.querySelector('.l-mic');
  const left = L.querySelector('[data-left]');
  const right = L.querySelector('[data-right]');
  const typeSlot = L.querySelector('[data-typeslot]');
  const foot = L.querySelector('.l-foot');

  let session;
  let partnerText = '';
  let turn = 0;
  let combo = 0;
  let fixes = 0;
  let sheet = null;
  let busy = false;
  let handsFree = prefs.get('handsFree', false);
  let micRef = null;
  const sessionXp = { n: 0 };
  if (!state.story) await loadStory().catch(() => {});
  const ep = allEpisodes().find((e) => e.id === scenarioId);
  const isCall = ep?.mode === 'call';
  let callTimer = null;
  if (isCall) {
    L.classList.add('call-mode');
    document.body.classList.add('call-ui');
    L.querySelector('.l-scene .mascot').outerHTML = `<span class="caller-av">${esc((ep.caller || '?').charAt(0))}</span>`;
  }
  state.cleanup = () => {
    sheet?.remove();
    recorder.release();
    clearInterval(callTimer);
    document.body.classList.remove('call-ui');
  };

  const setBar = (n, max) => {
    const pct = Math.max(4, Math.round((n / max) * 100));
    bar.firstElementChild.style.width = pct + '%';
    bar.setAttribute('aria-valuenow', String(pct));
  };
  const setMood = (m) => {
    masc.classList.remove('talking', 'think', 'cheer', 'oops');
    if (m) masc.classList.add(m);
  };
  const hfBtn = L.querySelector('[data-hf]');
  const paintHf = () => {
    hfBtn.classList.toggle('on', handsFree);
    hfBtn.setAttribute('aria-pressed', String(handsFree));
  };
  paintHf();
  hfBtn.addEventListener('click', () => {
    handsFree = !handsFree;
    prefs.set('handsFree', handsFree);
    paintHf();
    if (handsFree) track('handsfree_on');
    toast(handsFree ? "Hands-free on: I'll listen after I speak and send when you pause." : 'Hands-free off: tap the mic to talk.');
    if (handsFree && !busy && !sheet) micRef?.start();
  });

  async function speak(text, opts) {
    setMood('talking');
    await say(text, opts);
    setMood('');
  }

  function showPartner(text) {
    partnerText = text;
    textEl.textContent = text;
    L.querySelector('.l-bubble').classList.remove('pop');
    void textEl.offsetWidth;
    L.querySelector('.l-bubble').classList.add('pop');
    answer.hidden = true;
    answer.innerHTML = '';
    micBtn.disabled = false;
    busy = false;
    hint.textContent = turn === 0 ? 'Tap the mic and answer. Take your time.' : 'Your turn. Pauses are okay.';
    speak(text).then(() => {
      if (handsFree && !sheet && !busy) micRef?.start();
    });
  }
  L.querySelector('.l-say').addEventListener('click', () => {
    unlockAudio();
    track('replay_partner', null, session?.id);
    speak(partnerText);
  });

  // Start
  try {
    const r = await api('/sessions', { method: 'POST', body: { scenarioId, question: scenarioId === 'drill' ? state.drillQuestion : undefined } });
    session = r.session;
    if (isCall) {
      const t0 = Date.now();
      roleEl.innerHTML = `<b>${esc(ep.caller)} · ${esc(ep.callerRole || '')}</b><span class="call-live"><i></i><span data-ct>0:00</span> · Episode ${ep.n}</span>`;
      callTimer = setInterval(() => {
        const sec = Math.floor((Date.now() - t0) / 1000);
        const el = roleEl.querySelector('[data-ct]');
        if (el) el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      }, 1000);
    } else if (ep) {
      roleEl.innerHTML = `<b>Episode ${ep.n} · ${esc(ep.title)}</b><span class="scene">${esc(ep.setup)}</span>`;
    } else {
      roleEl.innerHTML = `<b>${esc(session.title)}</b>${I.briefcase(14)} ${scenarioId === 'drill' ? 'One question' : `Base plays: ${esc(session.partnerLabel || 'your partner')}`}${state.me?.user?.targetRoleLabel ? ` · for ${esc(state.me.user.targetRoleLabel)}` : ''}`;
    }
    setBar(0, session.maxTurns);
    showPartner(r.opener);
  } catch (e) {
    if (e.status === 409) {
      toast(e.message);
      return go('#/');
    }
    if (e.status === 402) {
      if (e.data?.reason === 'login') {
        track('login_prompt_shown', { from: 'limit' });
        sessionStorage.setItem('afterLogin', `#/talk/${scenarioId}`);
        return go('#/login');
      }
      return go('#/upgrade');
    }
    throw e;
  }

  L.querySelector('[data-exit]').addEventListener('click', () => {
    if (turn > 0 && !confirm('Leave this lesson? Your progress so far is saved.')) return;
    if (turn > 0) finish();
    else go('#/');
  });

  function resetSides() {
    left.innerHTML = '';
    right.innerHTML = '';
  }
  const mic = micControl(micBtn, {
    autoStop: () => handsFree,
    onState(st, sec) {
      if (st === 'recording') {
        hint.textContent = 'Listening… pause as much as you need';
        setMood('think');
        right.innerHTML = `<span class="timer">0:00</span>`;
        left.innerHTML = `<button class="linkish" data-cancel>Cancel</button>`;
        left.querySelector('[data-cancel]').addEventListener('click', () => {
          mic.cancel();
          resetSides();
          setMood('');
          hint.textContent = 'Your turn. Pauses are okay.';
        });
      } else if (st === 'tick') {
        const t = right.querySelector('.timer');
        if (t) t.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      } else resetSides();
    },
    onAudio(out) {
      sfx.send();
      buzz(15);
      submitTurn(audioForm(out));
    },
  });
  micRef = mic;

  L.querySelector('[data-type]').addEventListener('click', () => openTyping(typeSlot, (v) => {
    const f = new FormData();
    f.append('text', v);
    submitTurn(f);
  }));
  if (!Recorder.supported()) L.querySelector('[data-type]').click();

  async function submitTurn(form) {
    if (busy) return;
    busy = true;
    micBtn.disabled = true;
    setMood('think');
    answer.hidden = false;
    answer.innerHTML = `<span class="wave"><i></i><i></i><i></i><i></i><i></i></span>`;
    hint.textContent = 'Listening back…';
    const slow = setTimeout(() => (hint.textContent = 'Base is thinking…'), 1300);
    let r;
    try {
      r = await api(`/sessions/${session.id}/turn`, { method: 'POST', form });
    } catch (e) {
      clearTimeout(slow);
      answer.hidden = true;
      setMood('');
      toast(e.message);
      busy = false;
      micBtn.disabled = false;
      hint.textContent = 'Try once more — tap the mic.';
      return;
    }
    clearTimeout(slow);
    turn = r.turn;
    setBar(turn, r.maxTurns);
    answer.innerHTML = `<span class="a-k">You said</span>${markMl(r.transcript)}`;
    if (r.rewards?.xp) sessionXp.n += r.rewards.xp;
    handleRewards(r.rewards, answer);
    if (r.turn === 1 && !state.me?.stats?.sessionsDone) {
      setTimeout(() => {
        sfx.level();
        celebrate('Your first English reply!', 'തുടക്കം ഗംഭീരം!');
      }, 300);
    }
    if (r.correction) {
      fixes++;
      openFixSheet(r);
    } else {
      bumpCombo(true);
      openGoodSheet(r);
    }
  }

  function bumpCombo(win) {
    combo = win ? combo + 1 : 0;
    if (combo >= 2) {
      comboEl.hidden = false;
      comboEl.innerHTML = `${I.flame(16)}${combo}`;
      comboEl.classList.remove('pop');
      void comboEl.offsetWidth;
      comboEl.classList.add('pop');
      if (combo === 3 || combo === 5) toast(combo === 5 ? '5 in a row — unstoppable!' : '3 in a row — on fire!');
    } else comboEl.hidden = true;
  }

  function wordsHtml(r) {
    return r.lifeline?.length
      ? `<div class="fb-words">${r.lifeline.map((w) => `<span class="word-chip"><span class="ml">${esc(w.said)}</span> → <b>${esc(w.english)}</b></span>`).join('')}</div>`
      : '';
  }

  function makeSheet(cls, inner) {
    sheet?.remove();
    sheet = h(`<div class="fb-sheet ${cls}" role="dialog" aria-live="assertive">${inner}</div>`);
    document.body.append(sheet);
    foot.classList.add('covered');
    return sheet;
  }
  function closeSheet() {
    sheet?.remove();
    sheet = null;
    foot.classList.remove('covered');
  }

  const RATING = {
    3: { title: 'Natural, professional English!', cls: 'good', sub: 'You sound confident and clear.' },
    2: { title: 'Clear English!', cls: 'good', sub: 'Easy to understand. Here’s how to sound even more natural.' },
    1: { title: 'Understandable — let’s polish it', cls: 'fix', sub: 'Listen to how to say it naturally.' },
  };
  function coachHtml(r) {
    const c = r.coaching || {};
    const meter = [1, 2, 3].map((n) => `<i class="${n <= (c.rating || 0) ? 'on' : ''}"></i>`).join('');
    return `
      ${c.phrase ? `<div class="fb-tip"><span class="tip-k">${I.book(15)} USEFUL PHRASE</span><div class="tip-en"><button class="fb-say sm" data-phrase aria-label="Hear the phrase">${I.speaker(16)}</button>${esc(c.phrase)}</div>${c.phraseMl ? `<div class="tip-ml ml">${esc(c.phraseMl)}</div>` : ''}</div>` : ''}
      ${c.natural ? `<details class="fb-strong"><summary>${I.sparkle(16)} Hear it said naturally</summary><div class="fs-body"><button class="fb-say" data-strong aria-label="Listen">${I.speaker(20)}</button><span>${esc(c.natural)}</span></div><div class="small">Saved to <b>My best answers</b> and your <b>Phrasebook</b>.</div></details>` : ''}
      <span class="rate-meter" aria-label="English rating ${c.rating || 0} of 3">${meter}</span>`;
  }
  function wireCoach(s, r) {
    s.querySelector('[data-strong]')?.addEventListener('click', () => speak(r.coaching.natural, { slow: true }));
    s.querySelector('[data-phrase]')?.addEventListener('click', () => speak(r.coaching.phrase, { slow: true }));
    s.querySelector('.fb-strong')?.addEventListener('toggle', (e) => e.target.open && track('stronger_opened', null, session.id));
  }

  function openGoodSheet(r) {
    const R = RATING[r.coaching?.rating] || RATING[2];
    setMood(R.cls === 'good' ? 'cheer' : '');
    R.cls === 'good' ? sfx.success() : sfx.soft();
    buzz(20);
    const s = makeSheet(
      R.cls,
      `<div class="fb-top"><span class="fb-ic">${R.cls === 'good' ? I.check(26) : I.trend(24)}</span><div><div class="fb-title">${R.title}</div><div class="fb-sub">${esc(r.praise || R.sub)}</div></div></div>
      ${wordsHtml(r)}${coachHtml(r)}
      <button class="b3d ${R.cls === 'good' ? 'green' : 'gold'} block" data-next>Continue</button>`,
    );
    wireCoach(s, r);
    s.querySelector('[data-next]').addEventListener('click', () => next(r));
    s.querySelector('[data-next]').focus();
    if (handsFree && R.cls === 'good') setTimeout(() => sheet === s && !s.querySelector('details[open]') && next(r), 2600);
  }

  function openFixSheet(r) {
    const c = r.correction;
    const R = RATING[r.coaching?.rating] || RATING[2];
    setMood('');
    sfx.soft();
    let attempts = 0;
    const s = makeSheet(
      'fix',
      `<div class="fb-top"><span class="fb-ic">${I.bulb(24)}</span><div><div class="fb-title">${esc(R.title)}</div><div class="fb-sub">One English fix — say it out loud.</div></div>
        <span class="fb"><button data-fb="1" aria-label="Explanation was clear">${I.thumb(16)}</button><button data-fb="0" aria-label="Not clear">${I.thumb(16, true)}</button></span></div>
      ${wordsHtml(r)}
      <div class="fix-box">
        <div class="fx-k">${c.kind === 'word' ? 'SAY IT IN ENGLISH' : 'ENGLISH FIX'}</div>
        ${c.kind !== 'word' ? `<div class="fx-said"><s>${esc(c.youSaid)}</s></div>` : ''}
        <div class="fb-right"><button class="fb-say" data-fixsay aria-label="Hear it slowly">${I.speaker(20)}</button><span>${esc(c.sayItLikeThis)}</span></div>
        <div class="fb-why">${mascot('xs')}<span class="ml">${esc(c.explanationMl)}</span></div>
        ${c.repeated ? `<div class="fb-repeat">This one has come up ${c.timesMade} times — it's in your Mistake Bank.</div>` : ''}
      </div>
      <div class="fb-result" aria-live="polite"></div>
      <div class="fb-actions"><button class="b3d gold mic-btn block" data-retry>${I.mic(22)} <span>Say it out loud</span></button></div>
      <div class="fb-links"><button class="linkish" data-typefix>Type it</button><span data-skipslot></span></div>
      <div data-fixtype></div>
      <div data-coach hidden>${coachHtml(r)}</div>`,
    );
    wireCoach(s, r);
    const result = s.querySelector('.fb-result');
    const retryBtn = s.querySelector('[data-retry]');
    s.querySelector('[data-fixsay]').addEventListener('click', () => {
      track('replay_correction', null, session.id);
      speak(c.sayItLikeThis, { slow: true });
    });
    s.querySelectorAll('[data-fb]').forEach((b) =>
      b.addEventListener('click', () => {
        s.querySelectorAll('[data-fb]').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        track('correction_feedback', { helpful: b.dataset.fb === '1', mistakeId: c.mistakeId }, session.id);
      }),
    );
    speak(c.sayItLikeThis, { slow: true }).then(() => {
      if (handsFree && sheet === s) retryMic.start();
    });

    const afterFix = (passed) => {
      s.className = 'fb-sheet good';
      s.querySelector('.fb-title').textContent = passed ? 'You said it!' : 'Saved for later';
      s.querySelector('.fb-sub').textContent = passed ? 'Now one useful phrase to learn:' : 'It’s in your Mistake Bank. Here’s a useful phrase:';
      s.querySelector('.fb-ic').innerHTML = I.check(26);
      s.querySelector('.fix-box').classList.add('done');
      s.querySelector('.fb-links')?.remove();
      s.querySelector('[data-fixtype]')?.remove();
      s.querySelector('[data-coach]').hidden = false;
      s.querySelector('.fb-actions').innerHTML = `<button class="b3d green block" data-next>Continue</button>`;
      s.querySelector('.fb-actions').before(s.querySelector('[data-coach]'));
      s.querySelector('[data-next]').addEventListener('click', () => next(r));
      s.querySelector('[data-next]').focus();
    };

    async function check(form) {
      retryBtn.disabled = true;
      result.innerHTML = `<span class="small">Checking…</span>`;
      let rr;
      try {
        rr = await api('/retry', { method: 'POST', form });
      } catch (e) {
        result.innerHTML = '';
        toast(e.message);
        retryBtn.disabled = false;
        return;
      }
      attempts++;
      if (rr.pass) {
        bumpCombo(attempts === 1);
        if (rr.rewards?.xp) sessionXp.n += rr.rewards.xp;
        handleRewards(rr.rewards, retryBtn);
        sfx.success();
        buzz([20, 30, 40]);
        celebrate(rr.mastery?.justMastered ? 'Mistake mastered!' : 'Perfect!');
        setMood('cheer');
        result.innerHTML = `<div class="small">“${esc(rr.transcript)}”</div>`;
        afterFix(true);
      } else {
        bumpCombo(false);
        sfx.soft();
        setMood('oops');
        const missing = rr.missing?.length ? ` Listen for: <b>${rr.missing.map(esc).join(', ')}</b>` : '';
        result.innerHTML = `<div class="fb-no shake">Almost! Try once more.${missing}<span>We heard: “${esc(rr.transcript)}”</span></div>`;
        retryBtn.disabled = false;
        if (attempts >= 2 && !s.querySelector('[data-skip]')) {
          const sk = h(`<button class="linkish" data-skip>Skip for now</button>`);
          sk.addEventListener('click', () => {
            track('retry_skipped', { attempts }, session.id);
            result.innerHTML = '';
            afterFix(false);
          });
          s.querySelector('[data-skipslot]').append(sk);
        }
      }
    }
    const retryMic = micControl(retryBtn, {
      icon: `${I.mic(22)} <span>Say it out loud</span>`,
      stopIcon: `<span class="stopsq sm"></span> <span>Tap when done</span>`,
      autoStop: () => handsFree,
      onAudio(out) {
        sfx.send();
        check(audioForm(out, { target: c.sayItLikeThis, mistakeId: c.mistakeId, context: 'session', sessionId: session.id, attempt: attempts + 1 }));
      },
    });
    s.querySelector('[data-typefix]').addEventListener('click', () =>
      openTyping(s.querySelector('[data-fixtype]'), (v) => {
        const f = new FormData();
        f.append('text', v);
        f.append('target', c.sayItLikeThis);
        f.append('mistakeId', c.mistakeId);
        f.append('context', 'session');
        check(f);
      }),
    );
  }

  function next(r) {
    closeSheet();
    sfx.tap();
    if (r.done) return finish(r.reply);
    showPartner(r.reply);
  }

  let finishing = false;
  async function finish(closing) {
    if (finishing) return;
    finishing = true;
    mic.cancel();
    closeSheet();
    if (closing) {
      textEl.textContent = closing;
      setMood('cheer');
      micBtn.disabled = true;
      hint.textContent = '';
      await speak(closing).catch(() => {});
    }
    stopSpeaking();
    clearInterval(callTimer);
    document.body.classList.remove('call-ui');
    $app.innerHTML = '';
    $app.append(h(`<div class="lesson-wait">${mascot('lg', 'cheer')}<p>${isCall ? 'Call ended. Waiting for news…' : 'Counting what you learned…'}</p></div>`));
    try {
      const r = await api(`/sessions/${session.id}/end`, { method: 'POST' });
      await loadMe();
      renderComplete(r, scenarioId, { fixes, turns: turn });
    } catch (e) {
      toast(e.message);
      go('#/');
    }
  }
}

function openTyping(slot, onSend) {
  if (slot.querySelector('form')) return slot.querySelector('input').focus();
  const f = h(`<form class="type-form"><input placeholder="Type what you would say…" autocomplete="off" aria-label="Your reply" /><button class="b3d green">Send</button></form>`);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = f.querySelector('input').value.trim();
    if (!v) return;
    f.querySelector('input').value = '';
    onSend(v);
  });
  slot.append(f);
  f.querySelector('input').focus();
}

// ─── Lesson complete: a short sequence of reward screens ─────
function renderComplete(r, scenarioId, { fixes, turns }) {
  const seen = new Set();
  const words = r.words.filter((w) => !seen.has(w.english.toLowerCase()) && seen.add(w.english.toLowerCase()));
  const sec = Math.round(r.secondsSpoken);
  const steps = [];

  if (r.story) {
    steps.push(() => storyScreen(r));
    if (r.story.milestone) steps.push(() => milestoneScreen(r));
  }
  // 1) Lesson complete + stat tiles + level bar
  if (!r.story) steps.push(() => {
    const lb = r.levelBefore || r.level;
    const up = r.level && lb && r.level.level > lb.level;
    const el = h(`<section class="done-screen">
      <div class="burst">${mascot('xl', 'cheer')}</div>
      <h1 class="center">${scenarioId === 'mock_full' ? 'Mock interview done!' : scenarioId === 'drill' ? 'Well spoken!' : 'Lesson complete!'}</h1>
      <p class="center ml done-sub">${esc(r.coachNote || 'നന്നായി സംസാരിച്ചു!')}</p>
      <div class="tiles">
        <div class="tile3 gold"><div class="t-k">TOTAL XP</div><div class="t-v">${I.bolt(20)}<span data-c="${r.xp || 0}">0</span></div></div>
        <div class="tile3 green"><div class="t-k">SPOKE FOR</div><div class="t-v">${I.mic(18)}<span>${sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`}</span></div></div>
        <div class="tile3 blue"><div class="t-k">JOB ENGLISH</div><div class="t-v">${I.target(18)}<span data-c="${r.readiness?.score || 0}">0</span>%</div></div>
      </div>
      ${r.report ? `<div class="report"><div class="rp-k">YOUR ENGLISH IN THIS INTERVIEW</div>${r.report
        .map((x) => {
          const a = (state.meta?.areas || []).find((y) => y.id === x.area);
          const lbl = x.rating === 3 ? 'Natural' : x.rating === 2 ? 'Clear' : 'Keep practising';
          return `<div class="rp-row"><span>${esc(a?.label || x.area)}</span><span class="rp-r r${x.rating}">${lbl}</span></div>`;
        })
        .join('')}</div>` : ''}
      ${r.level ? `<div class="lvl-line"><span class="lv-badge" data-lv>${lb.level}</span><span class="lv-txt"><b data-lvname>${esc(lb.name)}</b><span class="lv-bar light"><i data-bar style="width:${Math.round(lb.progress * 100)}%"></i></span></span></div>` : ''}
      <div class="chips" data-chips></div>
    </section>`);
    setTimeout(() => {
      el.querySelectorAll('[data-c]').forEach((x) => countUp(x, Number(x.dataset.c)));
      sfx.success();
    }, 300);
    if (r.level) {
      setTimeout(() => {
        const bar = el.querySelector('[data-bar]');
        if (!bar) return;
        if (up) {
          bar.style.width = '100%';
          setTimeout(() => {
            el.querySelector('[data-lv]').textContent = r.level.level;
            el.querySelector('[data-lv]').classList.add('bump');
            el.querySelector('[data-lvname]').textContent = r.level.name;
            bar.style.transition = 'none';
            bar.style.width = '0%';
            void bar.offsetWidth;
            bar.style.transition = '';
            bar.style.width = `${Math.round(r.level.progress * 100)}%`;
            sfx.level();
            celebrate(`Level ${r.level.level}!`, r.level.ml);
          }, 750);
        } else bar.style.width = `${Math.round(r.level.progress * 100)}%`;
      }, 1100);
    }
    const chips = el.querySelector('[data-chips]');
    let d = 1700;
    const chip = (html, cls) =>
      setTimeout(() => {
        chips.append(h(`<span class="rw-chip ${cls}">${html}</span>`));
        sfx.xp();
      }, (d += 350));
    if (r.goalMet) chip(`${I.target(16)} Daily goal done`, 'gold');
    if (r.milestone) chip(`${I.flame(16)} ${r.milestone}-day streak!`, 'gold');
    for (const b of r.newBadges || []) chip(`${I.star(16)} ${esc(b.name)}`, 'star');
    for (const w of words.slice(0, 3)) chip(`<span class="ml">${esc(w.said)}</span> → ${esc(w.english)}`, '');
    return el;
  });

  // 2) Streak screen (first lesson of the day)
  if (r.firstToday && r.stats.streak > 0) {
    steps.push(() => {
      const week = r.stats.week
        .map((d, i) => `<div class="sd ${d.practiced ? 'on' : ''} ${i === r.stats.week.length - 1 ? 'today' : ''}"><span>${d.practiced ? I.check(14) : ''}</span>${new Date(d.day + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'narrow' })}</div>`)
        .join('');
      const el = h(`<section class="done-screen streak-screen">
        <div class="big-flame">${I.flame(120)}<span class="bf-n">${r.stats.streak}</span></div>
        <h1 class="center">${r.stats.streak === 1 ? 'You started a streak!' : `${r.stats.streak}-day streak!`}</h1>
        <p class="center done-sub">${r.stats.streak === 1 ? 'Come back tomorrow to make it 2.' : 'You showed up again. That is how speaking gets easy.'}</p>
        <div class="streak-week">${week}</div>
      </section>`);
      setTimeout(() => {
        sfx.level();
        buzz([30, 40, 60]);
      }, 200);
      return el;
    });
  }

  // 3) Save progress (guest) or tomorrow hook
  if (!r.story || r.needLogin) steps.push(() => {
    if (r.needLogin) {
      track('login_prompt_shown', { from: 'summary' });
      const el = h(`<section class="done-screen">
        <div class="burst">${mascot('xl', 'look')}</div>
        <h1 class="center">Don't lose your progress</h1>
        <p class="center done-sub">Save your ${r.mistakes.length} English fix${r.mistakes.length === 1 ? '' : 'es'}, your phrasebook and your progress — and unlock the next lessons.</p>
        <div class="fix-list">${r.mistakes.map((m) => `<div class="fix-line"><span class="tick">${I.check()}</span><div><div class="r">${esc(m.corrected)}</div></div></div>`).join('')}</div>
      </section>`);
      el._primary = { label: 'Save with my phone number', run: () => (sessionStorage.setItem('afterLogin', '#/'), go('#/login')) };
      el._secondary = { label: 'Maybe later', run: () => (track('login_skipped'), go('#/')) };
      return el;
    }
    const remindOn = state.me?.user?.reminders;
    const el = h(`<section class="done-screen">
      <div class="burst">${mascot('xl', 'wave')}</div>
      ${r.nextHook ? `<div class="hook-big"><div class="hook-k">TOMORROW</div><div class="hook-t">${esc(r.nextHook)}</div></div>` : `<h1 class="center">See you tomorrow!</h1>`}
      ${remindOn ? `<p class="center small">${I.bell(14)} I'll message you on WhatsApp if you forget.</p>` : `<button class="b3d white block" data-remind>${I.bell(18)} Remind me on WhatsApp</button>`}
      ${r.quests ? '<div data-q></div>' : ''}
    </section>`);
    if (r.quests) el.querySelector('[data-q]').append(questCard(r.quests));
    el.querySelector('[data-remind]')?.addEventListener('click', async (e) => {
      await api('/settings', { method: 'POST', body: { reminders: true } }).catch(() => {});
      e.currentTarget.outerHTML = `<p class="center small">${I.check(14)} Done — I'll message you if you forget.</p>`;
      sfx.tap();
    });
    el._secondary = { label: 'Share my progress', run: () => shareProgress(r, words) };
    return el;
  });

  let i = 0;
  const show = () => {
    $app.innerHTML = '';
    const screen = steps[i]();
    const foot = h(`<div class="done-foot"><button class="b3d green block" data-go>${esc(screen._primary?.label || (i < steps.length - 1 ? 'Continue' : 'Continue'))}</button>${screen._secondary ? `<button class="linkish" data-sec>${esc(screen._secondary.label)}</button>` : ''}</div>`);
    foot.querySelector('[data-go]').addEventListener('click', () => {
      sfx.tap();
      if (screen._primary) return screen._primary.run();
      i++;
      if (i < steps.length) show();
      else go(scenarioId === 'drill' ? '#/questions' : '#/');
    });
    foot.querySelector('[data-sec]')?.addEventListener('click', () => screen._secondary.run());
    $app.append(screen, foot);
    $app.classList.remove('enter');
    void $app.offsetWidth;
    $app.classList.add('enter');
  };
  show();
}

// ─── Mistake bank ────────────────────────────────────────────
async function renderBank() {
  const [{ mistakes }] = await Promise.all([api('/mistakes'), state.me || loadMe()]);
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  const open = mistakes.filter((m) => !m.mastered);
  const done = mistakes.filter((m) => m.mastered);
  $app.append(h(`<h1>Mistake Bank</h1>`));
  $app.append(h(`<p class="lead ml" style="font-size:16px">നിങ്ങളുടെ സ്വന്തം തെറ്റുകൾ. ${mistakes[0]?.target || 3} തവണ ശരിയായി പറഞ്ഞാൽ — mastered!</p>`));
  if (state.me.user.isGuest && mistakes.length) {
    const c = h(`<a class="feature gold" href="#/login" style="margin:0 0 14px"><span class="ic" style="color:var(--gold)">${I.book()}</span><span><b>Don't lose these</b><span class="s">Log in with your phone to save them</span></span><span class="go">${I.chev(22)}</span></a>`);
    c.addEventListener('click', () => sessionStorage.setItem('afterLogin', '#/bank'));
    $app.append(c);
  }
  if (!mistakes.length) {
    $app.append(emptyState(I.sprout(), 'Nothing here yet', 'Have a conversation and your personal fixes will appear here.', `<a class="btn" href="#/">Start speaking</a>`));
    return;
  }
  const tabs = h(`<div class="tabs"><button class="on" data-t="open">To practise · ${open.length}</button><button data-t="done">Mastered · ${done.length}</button></div>`);
  const list = h(`<div class="stack"></div>`);
  $app.append(tabs, list);
  const show = (which) => {
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === which));
    list.innerHTML = '';
    const items = which === 'open' ? open : done;
    if (!items.length) list.append(which === 'open' ? emptyState(I.trophy(), 'All mastered', 'Amazing work. Keep talking to find the next ones.') : emptyState(I.sprout(), 'Not yet', 'Say a sentence right 3 times to master it.'));
    for (const m of items) list.append(bankCard(m));
  };
  tabs.addEventListener('click', (e) => e.target.dataset.t && show(e.target.dataset.t));
  show('open');
  state.cleanup = () => recorder.release();
}

function bars(m) {
  return `<span class="bars" title="${m.timesSpokenRight}/${m.target} said right">${Array.from({ length: m.target }, (_, i) => `<i class="${i < m.timesSpokenRight ? 'on' : ''}"></i>`).join('')}</span>`;
}

function bankCard(m) {
  const card = h(`<div class="card bank-card ${m.kind === 'word' ? 'word' : ''}">
    <div class="head"><span class="label">${esc(m.label)}</span>${m.mastered ? `<span class="badge done">MASTERED</span>` : m.timesMade > 1 ? `<span class="badge made">MADE ${m.timesMade}×</span>` : ''}</div>
    ${m.kind !== 'word' ? `<div class="wrong">${esc(m.wrong)}</div>` : ''}
    <div class="right">${esc(m.corrected)}</div>
    <div class="why">${esc(m.explanationMl)}</div>
    <div class="meta">
      <button class="mini-mic" aria-label="Say it">${I.mic(24)}</button>
      <button class="listen-btn" data-listen aria-label="Listen">${I.speaker(22)}</button>
      <span data-bars style="margin-left:auto">${bars(m)}</span>
    </div>
    <div data-result></div>
  </div>`);
  card.querySelector('[data-listen]').addEventListener('click', () => {
    unlockAudio();
    say(m.corrected, { slow: true });
  });
  const res = card.querySelector('[data-result]');
  const btn = card.querySelector('.mini-mic');
  micControl(btn, {
    icon: I.mic(24),
    async onAudio(out) {
      btn.disabled = true;
      res.innerHTML = `<div class="small">Checking…</div>`;
      try {
        const r = await api('/retry', { method: 'POST', form: audioForm(out, { target: m.corrected, mistakeId: m.id, context: 'bank' }) });
        if (r.pass) {
          if (r.mastery) {
            m.timesSpokenRight = r.mastery.timesSpokenRight;
            card.querySelector('[data-bars]').innerHTML = bars(m);
          }
          res.innerHTML = `<div class="retry-result ok">${I.check(18)} ${r.mastery?.justMastered ? 'Mastered!' : 'Perfect!'}</div>`;
          sfx.success();
          handleRewards(r.rewards, res);
          celebrate(r.mastery?.justMastered ? 'Mistake mastered!' : 'Perfect!');
        } else {
          res.innerHTML = `<div class="retry-result no">Almost! Try again.<span class="heard">We heard: “${esc(r.transcript)}”</span></div>`;
        }
      } catch (e) {
        res.innerHTML = '';
        toast(e.message);
      }
      btn.disabled = false;
    },
  });
  return card;
}

// ─── Warm-up drill ───────────────────────────────────────────
async function renderWarmup(node) {
  const { items } = await api('/warmup');
  if (!state.me) await loadMe();
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  if (!items.length && node) {
    // Nothing to review yet (no mistakes!) — the review step counts as done.
    const r = await api(`/path/${node}/complete`, { method: 'POST' }).catch(() => null);
    $app.append(emptyState(I.trophy(), 'No mistakes to fix!', 'Your answers have been clean so far — this review is done.', `<a class="b3d green" href="#/">Continue</a>`));
    if (r) sfx.success();
    return;
  }
  if (!items.length) {
    $app.append(emptyState(I.sprout(), 'Nothing to warm up yet', 'Have a conversation first!', `<a class="btn" href="#/">Start speaking</a>`));
    return;
  }
  state.cleanup = () => recorder.release();
  let i = 0;
  let passed = 0;
  const box = h(`<div></div>`);
  $app.append(h(`<h1>Warm-up</h1>`), h(`<p class="lead">Your own past mistakes. Say each one the right way.</p>`), box);

  const next = () => {
    if (i >= items.length) return finishWarmup();
    const m = items[i];
    box.innerHTML = '';
    const card = h(`<div class="card warm">
      <div class="segments" style="margin:0">${items.map((_, k) => `<i class="${k < i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="small" style="font-weight:700">${i + 1} of ${items.length} · ${esc(m.label)}</div>
      ${m.kind === 'word'
        ? `<div class="q">How do you say this in English?</div><div class="why">${esc(m.explanationMl)}</div>`
        : `<div class="q">Say this the right way:</div><div class="wrongq">“${esc(m.wrong)}”</div>`}
      <div data-answer style="display:none"><div class="ans">${esc(m.corrected)}</div>${m.kind !== 'word' ? `<div class="why" style="margin-top:10px">${esc(m.explanationMl)}</div>` : ''}</div>
      <div class="ctrl">
        <button class="btn ghost" data-peek>Show answer</button>
        <div class="mic-halo"><button class="mic retry" aria-label="Say it">${MIC_SVG}<span class="ring"></span></button></div>
        <button class="btn ghost" data-skip>Skip</button>
      </div>
      <div data-result></div>
    </div>`);
    box.append(card);
    const answer = card.querySelector('[data-answer]');
    card.querySelector('[data-peek]').addEventListener('click', () => {
      answer.style.display = '';
      unlockAudio();
      say(m.corrected, { slow: true });
    });
    card.querySelector('[data-skip]').addEventListener('click', () => {
      i++;
      next();
    });
    const res = card.querySelector('[data-result]');
    const btn = card.querySelector('.mic');
    micControl(btn, {
      async onAudio(out) {
        btn.disabled = true;
        res.innerHTML = `<div class="small center">Checking…</div>`;
        try {
          const r = await api('/retry', { method: 'POST', form: audioForm(out, { target: m.corrected, mistakeId: m.id, context: 'warmup' }) });
          if (r.pass) {
            passed++;
            answer.style.display = '';
            res.innerHTML = `<div class="retry-result ok">${I.check(18)} Perfect!</div>`;
            sfx.success();
            handleRewards(r.rewards, res);
            celebrate(r.mastery?.justMastered ? 'Mistake mastered!' : 'Perfect!');
            await sleep(1300);
            i++;
            return next();
          }
          answer.style.display = '';
          res.innerHTML = `<div class="retry-result no">Almost! Listen to the right sentence and try again.<span class="heard">We heard: “${esc(r.transcript)}”</span></div>`;
        } catch (e) {
          res.innerHTML = '';
          toast(e.message);
        }
        btn.disabled = false;
      },
    });
  };

  const finishWarmup = async () => {
    const r = await api('/warmup/done', { method: 'POST', body: { passed, total: items.length, node } }).catch(() => null);
    if (r) {
      state.me.stats = r.stats;
      handleRewards(r.rewards);
    }
    box.innerHTML = '';
    box.append(
      emptyState(I.bolt(36), 'Warm-up done!', `You said ${passed} of ${items.length} sentences the right way.`, `<div class="stack"><a class="btn block" href="#/">Now have a conversation</a><a class="btn block secondary" href="#/bank">Open Mistake Bank</a></div>`),
    );
  };
  next();
}

// ─── Login (phone / WhatsApp OTP) ────────────────────────────
async function renderLogin() {
  if (!state.me) await loadMe();
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  const box = h(`<section></section>`);
  $app.append(box);
  const after = () => {
    const to = sessionStorage.getItem('afterLogin') || '#/';
    sessionStorage.removeItem('afterLogin');
    go(to);
  };

  const stepPhone = () => {
    box.innerHTML = '';
    const f = h(`<form>
      <div class="kasavu" style="margin-top:8px"></div>
      <h1>Save your progress</h1>
      <p class="lead">We'll send a 6-digit code to your WhatsApp. No password needed.</p>
      <label class="lbl" for="ph">Mobile number</label>
      <div class="field"><span class="pre">+91</span><input id="ph" type="tel" inputmode="tel" autocomplete="tel" placeholder="98765 43210" required /></div>
      <div class="err"></div>
      <button class="btn block gold" style="margin-top:6px">Send code ${I.arrow()}</button>
      <p class="small center" style="margin-top:14px">Your Mistake Bank, streak and memory are saved to this number.</p>
    </form>`);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const raw = f.querySelector('input').value.trim();
      const phone = raw.startsWith('+') ? raw : '+91' + raw.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0/, '');
      const btn = f.querySelector('button');
      btn.disabled = true;
      try {
        const r = await api('/auth/request-otp', { method: 'POST', body: { phone } });
        stepCode(r.phone, r.provider, r.pilotCode);
      } catch (err) {
        f.querySelector('.err').textContent = err.message;
        btn.disabled = false;
      }
    });
    box.append(f);
    f.querySelector('input').focus();
  };

  const stepCode = (phone, provider, pilotCode) => {
    box.innerHTML = '';
    const f = h(`<form>
      <h1>Enter the code</h1>
      <p class="lead">${pilotCode ? `Pilot version: enter <b>${esc(pilotCode)}</b> for any number.` : `Sent to ${esc(phone)}.`} ${provider === 'console' ? '<br/><span class="small">(Pilot mode: the code is in the server log.)</span>' : ''}</p>
      <div class="field otp"><input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="6-digit code" required /></div>
      <div class="err"></div>
      <button class="btn block" style="margin-top:6px">Verify</button>
      <button type="button" class="btn ghost block" data-change>Change number</button>
    </form>`);
    f.querySelector('[data-change]').addEventListener('click', stepPhone);
    const input = f.querySelector('input');
    input.addEventListener('input', () => input.value.replace(/\D/g, '').length === 6 && f.requestSubmit());
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = f.querySelector('button');
      btn.disabled = true;
      try {
        const r = await api('/auth/verify', { method: 'POST', body: { phone, code: input.value.replace(/\D/g, '') } });
        await loadMe();
        if (!r.user.name || !r.user.jobRole) stepProfile();
        else {
          toast('Welcome back!');
          after();
        }
      } catch (err) {
        f.querySelector('.err').textContent = err.message;
        btn.disabled = false;
      }
    });
    box.append(f);
    input.focus();
  };

  const stepProfile = () => {
    box.innerHTML = '';
    const f = profileForm(state.me.user, 'Tell Base about you', 'So your interview questions match your real background. (Optional)', 'Save & continue');
    f.addEventListener('saved', stepGoal);
    const skip = h(`<button type="button" class="btn ghost block">Skip</button>`);
    skip.addEventListener('click', stepGoal);
    f.append(skip);
    box.append(f);
  };

  const stepGoal = () => {
    box.innerHTML = '';
    const f = goalForm(state.me.user, { title: 'Set a small daily goal', cta: 'Start practising' });
    f.addEventListener('saved', async () => {
      await api('/settings', { method: 'POST', body: { onboarded: true } }).catch(() => {});
      toast('All set! Your free sessions are unlocked.');
      after();
    });
    box.append(f);
  };

  if (!state.me.user.isGuest) stepProfile();
  else stepPhone();
}

/** Daily goal + WhatsApp reminder opt-in (used in onboarding and settings). */
function goalForm(u, { title, cta }) {
  let goal = u.dailyGoalMin || 5;
  let rem = u.reminders ?? false;
  const opts = [
    [5, 'Easy', 'ലളിതം'],
    [10, 'Steady', 'സ്ഥിരം'],
    [15, 'Serious', 'ഗൗരവം'],
  ];
  const f = h(`<form>
    ${title ? `<h1>${esc(title)}</h1><p class="lead">Small and daily beats long and rare. You can change this any time.</p>` : ''}
    <div class="goal-opts" role="radiogroup" aria-label="Daily goal">${opts
      .map(([m, t, ml]) => `<button type="button" role="radio" class="goal-opt ${m === goal ? 'on' : ''}" data-m="${m}" aria-checked="${m === goal}"><span class="m">${m}<small>min</small></span><span class="t">${t}</span><span class="ml s">${ml}</span></button>`)
      .join('')}</div>
    <label class="toggle-row"><span class="ic">${I.bell()}</span><span><b>Friendly reminders on WhatsApp</b><span class="s">A short personal message from Base on days you haven't practised. Never spam.</span></span>
      <input type="checkbox" class="switch" ${rem ? 'checked' : ''} /></label>
    <div class="err"></div>
    <button class="btn block" style="margin-top:12px">${esc(cta)}</button>
  </form>`);
  f.querySelectorAll('.goal-opt').forEach((b) =>
    b.addEventListener('click', () => {
      goal = Number(b.dataset.m);
      f.querySelectorAll('.goal-opt').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
    }),
  );
  f.querySelector('.switch').addEventListener('change', (e) => (rem = e.target.checked));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/settings', { method: 'POST', body: { dailyGoalMin: goal, reminders: rem } });
      await loadMe();
      f.dispatchEvent(new Event('saved'));
    } catch (err) {
      f.querySelector('.err').textContent = err.message;
    }
  });
  return f;
}

function profileForm(u, title, sub, cta) {
  const goals = ['Job interview', 'Office meetings', 'Moving abroad', 'Daily confidence'];
  const f = h(`<form>
    <h1>${esc(title)}</h1>
    <p class="lead">${esc(sub)}</p>
    <label class="lbl" for="nm">Your name</label>
    <input class="input" id="nm" name="name" autocomplete="given-name" value="${esc(u.name || '')}" placeholder="e.g. Anjali" />
    <label class="lbl" for="jr">What do you do now?</label>
    <input class="input" id="jr" name="jobRole" value="${esc(u.jobRole || '')}" placeholder="e.g. BSc Nursing final year, Tester at TCS" />

    <div class="err"></div>
    <button class="btn block" style="margin-top:8px">${esc(cta)}</button>
  </form>`);
  let goal = u.goals || '';

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/profile', { method: 'POST', body: { name: f.name.value, jobRole: f.jobRole.value, goals: goal } });
      await loadMe();
      f.dispatchEvent(new Event('saved'));
    } catch (err) {
      f.querySelector('.err').textContent = err.message;
    }
  });
  return f;
}

// ─── Settings ────────────────────────────────────────────────
async function renderSettings() {
  await loadMe();
  if (state.me.user.isGuest) return go('#/login');
  state.welcome = false;
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  const u = state.me.user;
  const a = state.me.allowance;
  $app.append(h(`<h1>Settings</h1>`));

  const plan = h(`<div class="card dark"><div class="kasavu"></div><div class="display" style="font-weight:700;font-size:18px;margin-top:10px">Your plan</div><p style="margin:4px 0 12px;color:#b9c8c3;font-size:14px">${
    a.plan === 'paid' ? 'Monthly pass — active' : a.canStart ? `Free trial · ${a.remaining} session${a.remaining === 1 ? '' : 's'} left` : 'Free trial finished'
  }</p>${a.plan === 'paid' ? `<a class="btn outline" style="color:var(--cream);border-color:var(--cream)" href="${esc(state.me.upgrade.url || '#')}" target="_blank" rel="noopener">Manage subscription</a>` : `<a class="btn gold" href="#/upgrade">See the monthly pass</a>`}</div>`);
  $app.append(plan);

  const d = u.daysToInterview;
  $app.append(
    h(`<a class="big-card white" href="#/job" style="margin-top:14px"><span class="bc-ic" style="background:var(--leaf-l);color:var(--leaf-d)">${I.briefcase(26)}</span><span><b>${u.targetRoleLabel ? esc(u.targetRoleLabel) : 'Set your target job'}</b><span>${[
      (state.meta?.experienceLevels || []).find((e) => e.id === u.experience)?.label,
      u.company,
      d !== null && d >= 0 ? `interview in ${d} day${d === 1 ? '' : 's'}` : null,
    ]
      .filter(Boolean)
      .map(esc)
      .join(' · ') || 'Job, experience, company & interview date'}</span></span><span class="go">${I.chev(22)}</span></a>`),
  );
  $app.append(h(`<h2>Daily practice</h2>`));
  const gf = goalForm(u, { cta: 'Save' });
  gf.addEventListener('saved', () => toast('Saved'));
  $app.append(gf);

  const snd = h(`<label class="toggle-row"><span class="ic">${I.speaker(20)}</span><span><b>Sounds &amp; vibration</b><span class="s">Little sounds when you get it right.</span></span><input type="checkbox" class="switch" ${prefs.get('sound', true) ? 'checked' : ''} /></label>`);
  snd.querySelector('input').addEventListener('change', (e) => {
    prefs.set('sound', e.target.checked);
    if (e.target.checked) sfx.success();
    else track('sound_off');
  });
  $app.append(snd);

  $app.append(h(`<h2>About you</h2>`));
  const pf = profileForm(u, '', '', 'Save');
  pf.querySelector('h1')?.remove();
  pf.querySelector('.lead')?.remove();
  pf.addEventListener('saved', () => toast('Saved'));
  $app.append(pf);

  $app.append(h(`<h2>More</h2>`));
  const links = h(`<div class="list-card">
    <a class="list-btn" href="#/badges">${I.star(22)}<span class="t">Level &amp; badges</span><span class="go">${I.chev()}</span></a>
    <a class="list-btn" href="#/invite">${I.gift()}<span class="t">Invite a friend</span><span class="go">${I.chev()}</span></a>
    <a class="list-btn" href="${esc(state.me.upgrade.url || '#')}" target="_blank" rel="noopener">${I.chat()}<span class="t">Help on WhatsApp</span><span class="go">${I.chev()}</span></a>
    <a class="list-btn" href="#/privacy">${I.shield()}<span class="t">Privacy policy</span><span class="go">${I.chev()}</span></a>
    <a class="list-btn" href="#/terms">${I.info()}<span class="t">Terms &amp; refunds</span><span class="go">${I.chev()}</span></a>
  </div>`);
  $app.append(links);
  $app.append(h(`<p class="small center" style="margin-top:14px">Logged in as ${esc(u.phone)}</p>`));
  const out = h(`<button class="btn secondary block">Log out</button>`);
  out.addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    state.me = null;
    go('#/');
  });
  const del = h(`<button class="btn ghost block danger">${I.trash(18)} Delete my account &amp; data</button>`);
  del.addEventListener('click', async () => {
    if (!confirm('Delete your account, Mistake Bank and history? This cannot be undone.')) return;
    await api('/me', { method: 'DELETE' });
    state.me = null;
    toast('Your data has been deleted.');
    go('#/');
  });
  $app.append(h(`<div class="stack" style="margin-top:8px"></div>`));
  $app.lastElementChild.append(out, del);
}

// ─── Invite a friend (referral loop) ─────────────────────────
async function renderInvite() {
  await loadMe();
  if (state.me.user.isGuest) {
    sessionStorage.setItem('afterLogin', '#/invite');
    return go('#/login');
  }
  const inv = await api('/invite');
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  const text = `I'm learning English for my job with Base — you practise interviews, HR calls and office English out loud, and it explains every fix in Malayalam. Try it free: ${inv.url}`;
  const box = h(`<section>
    <div class="invite-art">${I.gift(44)}</div>
    <h1 class="center">Learn together</h1>
    <p class="lead center">When a friend joins with your link, you <b>both</b> get <b>${inv.bonus} free sessions</b>.</p>
    <div class="code-box"><span class="small">Your invite link</span><span class="code">${esc(inv.url.replace(/^https?:\/\//, ''))}</span></div>
    <div class="stack" style="margin-top:14px">
      <a class="btn block whatsapp-real" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" data-wa>${I.chat()} Share on WhatsApp</a>
      <button class="btn block secondary" data-copy>${I.share()} Copy link</button>
    </div>
    <p class="foot-note">${inv.joined ? `${inv.joined} friend${inv.joined === 1 ? '' : 's'} joined so far — thank you!` : 'Tip: share in your family or college WhatsApp group.'}</p>
  </section>`);
  box.querySelector('[data-wa]').addEventListener('click', () => track('invite_shared', { via: 'whatsapp' }));
  box.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(inv.url);
      toast('Link copied');
    } catch {
      prompt('Copy your link:', inv.url);
    }
    track('invite_shared', { via: 'copy' });
  });
  $app.append(box);
}

// ─── Privacy & terms (plain-language; fill the [placeholders] before launch) ──
function renderLegal(which) {
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  const privacy = `<h1>Privacy policy</h1>
    <p class="lead">Plain language: what we keep, and why.</p>
    <div class="legal">
    <h3>What we collect</h3><ul><li>Your phone number, to log you in and (only if you turn it on) send reminders.</li><li>The <b>text</b> of what you say during practice, your corrections and your progress.</li><li>Your name, job and goals, if you share them, so Base can remember you.</li></ul>
    <h3>What we don't keep</h3><ul><li>Your voice recordings. Audio is turned into text and then discarded.</li></ul>
    <h3>Who processes it</h3><ul><li>OpenAI processes your audio and text to transcribe, correct and reply. Your data is not used to train their models through our API account.</li><li>Our messaging provider delivers login codes and reminders.</li></ul>
    <h3>Your control</h3><ul><li>Turn reminders off any time in Settings.</li><li>Delete your account and all data from Settings → Delete my account.</li></ul>
    <h3>Contact</h3><p>[COMPANY NAME] · [CONTACT EMAIL / WHATSAPP]</p></div>`;
  const terms = `<h1>Terms &amp; refunds</h1>
    <p class="lead">The short version.</p>
    <div class="legal">
    <h3>The service</h3><p>Base is a practice partner. It can make mistakes; it is not a certified exam or test.</p>
    <h3>Monthly pass</h3><ul><li>Renews monthly until you cancel. Cancel any time — you keep access until the end of the month.</li><li>Includes a fair daily practice allowance.</li></ul>
    <h3>10-day refund promise</h3><p>Not happy in the first 10 days after paying? Message us and we'll refund you in full — no questions asked.</p>
    <h3>Be kind</h3><p>Don't use Base to create harmful content or to abuse the service.</p>
    <h3>Contact</h3><p>[COMPANY NAME] · [CONTACT EMAIL / WHATSAPP]</p></div>`;
  $app.append(h(`<section>${which === 'privacy' ? privacy : terms}</section>`));
}

// ─── Upgrade / limits ────────────────────────────────────────
async function renderUpgrade() {
  await loadMe();
  const a = state.me.allowance;
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  track('paywall_shown', { reason: a.reason });
  if (a.reason === 'daily_limit') {
    $app.append(emptyState(I.moon(), "That's enough for today", 'Great work. Your brain learns while you rest — come back tomorrow to keep your streak.', `<a class="btn" href="#/bank">Review your Mistake Bank</a>`));
    return;
  }
  const s = state.me.stats;
  const card = h(`<section>
    <h1>Keep learning English for your career</h1>
    <p class="lead">In your free sessions you spoke English for <b>${s.minutesSpoken} minutes</b> and reached <b>${state.me.readiness?.score || 0}% job-ready English</b>. Keep going until it feels easy.</p>
    <div class="card dark stack">
      <div class="kasavu"></div>
      <div class="display" style="font-size:26px;font-weight:800;letter-spacing:-0.02em">Monthly pass · <span style="color:var(--gold)">${esc(state.me.upgrade.price)}</span></div>
      <div class="fix-line"><span class="tick" style="background:var(--gold);color:var(--ink)">${I.check()}</span><span>All lessons: interviews, HR calls & English at work</span></div>
      <div class="fix-line" style="margin-top:0"><span class="tick" style="background:var(--gold);color:var(--ink)">${I.check()}</span><span>Your phrasebook, best answers & mistake warm-ups</span></div>
      <div class="fix-line" style="margin-top:0"><span class="tick" style="background:var(--gold);color:var(--ink)">${I.check()}</span><span>A teacher who remembers you and your job</span></div>
      <a class="btn block gold" data-up href="${esc(state.me.upgrade.url || '#/')}" target="_blank" rel="noopener">Get the monthly pass</a>
    </div>
    <p class="foot-note">Less than a cup of coffee a week · <a href="#/terms">10-day refund promise</a></p>
  </section>`);
  card.querySelector('[data-up]').addEventListener('click', () => track('upgrade_clicked'));
  $app.append(card);
}

// ─── Share card (Strava-style progress post for stories / WhatsApp) ──
async function shareProgress(r, words) {
  track('share_progress');
  let url = location.origin + '/';
  if (!state.me?.user?.isGuest) url = (await api('/invite').catch(() => null))?.url || url;
  await document.fonts?.ready;
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const x = c.getContext('2d');
  x.fillStyle = '#0E5A4A';
  x.fillRect(0, 0, 1080, 1350);
  x.strokeStyle = '#1A6E5C';
  x.lineWidth = 80;
  x.beginPath();
  x.arc(980, 160, 260, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = '#E2A93B';
  x.fillRect(90, 150, 140, 8);
  x.fillRect(90, 168, 140, 4);
  x.fillStyle = '#FBF6EC';
  x.font = '800 64px "Bricolage Grotesque", sans-serif';
  x.fillText('base.', 90, 120);
  x.font = '800 34px Manrope, sans-serif';
  x.fillStyle = '#CFE4DC';
  x.fillText('I SPOKE ENGLISH OUT LOUD FOR', 90, 300);
  const sec = Math.round(r.secondsSpoken);
  x.fillStyle = '#FBF6EC';
  x.font = '800 260px "Bricolage Grotesque", sans-serif';
  const big = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : String(sec);
  x.fillText(big, 80, 560);
  const bw = x.measureText(big).width;
  x.fillStyle = '#E2A93B';
  x.font = '800 72px "Bricolage Grotesque", sans-serif';
  x.fillText(sec >= 60 ? 'min' : 'sec', 100 + bw, 560);
  x.fillStyle = '#FBF6EC';
  x.font = '700 48px Manrope, sans-serif';
  x.fillText(`${r.stats.streak}-day streak  ·  ${r.turns} replies  ·  ${r.mistakes.length} fixes`, 90, 690);
  if (words.length) {
    x.font = '600 44px "Baloo Chettan 2", sans-serif';
    x.fillStyle = '#E2A93B';
    x.fillText(`New word: ${words[0].said} → ${words[0].english}`, 90, 790);
  }
  x.fillStyle = '#E2A93B';
  x.beginPath();
  x.roundRect(60, 1080, 960, 200, 40);
  x.fill();
  x.fillStyle = '#14211E';
  x.font = '800 54px "Bricolage Grotesque", sans-serif';
  x.fillText('Learn English for your job — free', 110, 1170);
  x.font = '700 38px Manrope, sans-serif';
  x.fillText(url.replace(/^https?:\/\//, ''), 110, 1235);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'my-english-progress.png', { type: 'image/png' });
  const text = `I spoke English for ${big} ${sec >= 60 ? 'min' : 'sec'} today with Base — learning English for a better job! Learn with me: ${url}`;
  try {
    if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text });
    if (navigator.share) return await navigator.share({ text, url });
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  toast('Image saved — post it to your WhatsApp status or Instagram story!');
}

// ─── Boot ────────────────────────────────────────────────────
(async () => {
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  if (ref) {
    await api('/referral', { method: 'POST', body: { code: ref } }).catch(() => {});
    params.delete('ref');
    history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '') + location.hash);
  }
  router();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();

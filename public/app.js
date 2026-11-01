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
function micControl(btn, { onAudio, onState, maxSec = 120, icon = MIC_SVG, autoStop }) {
  let recording = false;
  let timer;
  let heard = false;
  let lastLoud = 0;
  const ring = btn.querySelector('.ring');
  const setUi = (state) => {
    recording = state === 'recording';
    btn.classList.toggle('recording', recording);
    btn.innerHTML = (recording ? STOP_SVG : icon) + (ring ? '<span class="ring"></span>' : '');
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

// ─── App state & routing ─────────────────────────────────────
const state = { me: null, scenarios: null, cleanup: null };

async function loadMe() {
  state.me = await api('/me');
  return state.me;
}

const routes = [
  [/^#?\/?$/, renderHome],
  [/^#\/talk\/(\w+)$/, renderTalk],
  [/^#\/bank$/, renderBank],
  [/^#\/warmup$/, renderWarmup],
  [/^#\/login$/, renderLogin],
  [/^#\/profile$/, renderSettings],
  [/^#\/settings$/, renderSettings],
  [/^#\/invite$/, renderInvite],
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

function skeletonHome() {
  $app.innerHTML = `<div class="skel" aria-hidden="true"><div class="sk sk-bar" style="width:90px"></div><div class="sk" style="height:38px;width:70%;margin-top:28px"></div><div class="sk" style="height:16px;width:85%;margin-top:12px"></div><div class="sk" style="height:150px;margin-top:20px;border-radius:26px"></div><div class="sk" style="height:110px;margin-top:14px;border-radius:22px"></div></div>`;
}

async function renderHome() {
  if (!state.me) skeletonHome();
  const [me, sc] = await Promise.all([loadMe(), state.scenarios || api('/scenarios')]);
  state.scenarios = sc;
  const s = me.stats;
  const isNew = s.sessionsDone === 0;
  $app.innerHTML = '';
  $app.append(topbar());
  const [c1, c2, c3] = sc.categories;

  if (isNew) {
    $app.querySelector('.topbar').classList.add('clear');
    $app.append(
      h(`<section class="hero">
        <div class="blob"></div><div class="dot-deco"></div>
        <h1 class="ml">English മനസ്സിലാകും.<br />സംസാരിക്കാൻ <span class="squiggle">മടി${SQUIGGLE}</span>, അല്ലേ?</h1>
        <p class="lead">Practise speaking with a patient partner. No rush, no judging — just you and your voice.</p>
        <div class="say-hi">${avatar()}<div class="b">Hi! I'm Base. Take all the time you need — I'll wait.</div></div>
        <div class="bento">
          <button class="tile hero-tile" data-scenario="${c1.defaultScenario}"><span class="ic" style="color:var(--ink)">${CAT_ICON[c1.id](26)}</span><span><span class="t">Job interview</span><br /><span class="s">${esc(c1.titleMl)}</span></span></button>
          <button class="tile" data-scenario="${c2.defaultScenario}"><span class="ic" style="color:var(--green)">${CAT_ICON[c2.id]()}</span><span><span class="t">At the office</span><br /><span class="s">${esc(c2.titleMl)}</span></span></button>
          <button class="tile gold-ic" data-scenario="${c3.defaultScenario}"><span class="ic" style="color:var(--gold-ink)">${CAT_ICON[c3.id]()}</span><span><span class="t">Daily life</span><br /><span class="s">${esc(c3.titleMl)}</span></span></button>
        </div>
        <div class="sticker">${I.buoy()}<div><b>Stuck on a word?</b><div class="ml">മലയാളത്തിൽ പറഞ്ഞോളൂ — ഞങ്ങൾ English പഠിപ്പിക്കാം.</div></div></div>
        <div class="foot-note">Free to try · No signup · 5 minutes a day</div>
      </section>`),
    );
  } else {
    const first = me.user.name ? esc(me.user.name.split(' ')[0]) : '';
    const hr = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
    const greet = hr < 12 ? 'Morning' : hr < 17 ? 'Hi' : 'Evening';
    const todayIdx = s.week.length - 1;
    const week = s.week
      .map((d, i) => {
        const wd = new Date(d.day + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'narrow' });
        return `<div class="d ${i === todayIdx ? 'today' : ''}"><div class="bar ${d.practiced ? 'on' : ''}"></div>${wd}</div>`;
      })
      .join('');
    const a = me.allowance;
    $app.append(
      h(`<section>
        <h1>${greet}${first ? ', ' + first : ''}</h1>
        <p class="lead" style="margin-bottom:16px">${s.practicedToday ? 'Nice — you practised today. One more?' : 'A few minutes of speaking keeps the fear away.'}</p>
        <div class="streak-card">
          <div class="streak-top">
            <span style="color:var(--gold)">${I.flame(34)}</span>
            <span class="n">${s.streak}</span><span class="l">day streak</span>
            <span class="side">${goalRing(s.secondsToday, me.user.dailyGoalMin || 5)}<span class="goal-l">today's goal</span></span>
          </div>
          <div class="week">${week}</div>
        </div>
      </section>`),
    );
    if (me.nudge) {
      const n = h(`<div class="nudge" role="status">${avatar()}<div class="b"><div class="who">Base</div>${esc(me.nudge.text)}</div><button class="x" aria-label="Dismiss">${I.close(14)}</button></div>`);
      n.querySelector('.x').addEventListener('click', () => {
        api(`/nudges/${me.nudge.id}/read`, { method: 'POST' }).catch(() => {});
        n.remove();
      });
      $app.append(n);
    }
    if (me.warmup.due) {
      $app.append(
        h(`<a class="feature gold" href="#/warmup"><span class="ic" style="color:var(--gold)">${I.bolt()}</span><span><b>2-minute warm-up</b><span class="s">${me.warmup.pending} of your own mistakes</span></span><span class="go">${I.chev(22)}</span></a>`),
      );
    }
    $app.append(h(`<h2>Talk about something</h2>`));
    $app.append(
      h(`<div class="tiles-3">${sc.categories
        .map(
          (c, i) =>
            `<button class="tile ${i === 0 ? 'green' : ''}" data-scenario="${c.defaultScenario}"><span style="color:${i === 0 ? 'var(--gold)' : i === 1 ? 'var(--green)' : 'var(--gold-ink)'}">${CAT_ICON[c.id]()}</span><span class="t">${esc(['Interview', 'Office', 'Daily life'][i] || c.title)}</span></button>`,
        )
        .join('')}</div>`),
    );
    const ins = me.insights;
    if (ins && ins.replies) {
      $app.append(h(`<h2>Your speaking this week</h2>`));
      $app.append(
        h(`<div class="insights">
          <div class="ins"><div class="v">${ins.wordsPerReply}</div><div class="l">words per reply</div>${trendLine(ins.wordsPerReply, ins.wordsPerReplyPrev, '')}<div class="hint">Longer answers = more confidence</div></div>
          <div class="ins"><div class="v">${ins.cleanReplyRate}<small>%</small></div><div class="l">replies with no fix needed</div><div class="hint">${ins.replies} replies this week</div></div>
          <div class="ins"><div class="v">${ins.lifelineWords}</div><div class="l">Malayalam words used</div>${trendLine(ins.lifelineWords, ins.lifelineWordsPrev, '', true)}<div class="hint">Fewer over time = growing vocabulary</div></div>
          <div class="ins"><div class="v">${ins.masteredThisWeek}</div><div class="l">old mistakes mastered</div><div class="hint">${ins.daysThisWeek}/7 days practised</div></div>
        </div>`),
      );
    }
    if (!me.user.isGuest) {
      $app.append(
        h(`<a class="feature invite" href="#/invite"><span class="ic" style="background:var(--gold-soft);color:var(--gold-ink)">${I.gift()}</span><span><b>Practise with a friend</b><span class="s">Invite someone — you both get free sessions</span></span><span class="go">${I.chev(22)}</span></a>`),
      );
    }
    if (s.mistakesTotal) {
      $app.append(
        h(`<a class="line-link" href="#/bank" style="margin-top:14px">${I.book()}<span>Mistake Bank <span class="s">· ${s.mistakesTotal - s.mistakesMastered} to practise</span></span><span class="go" style="color:var(--muted)">${I.chev()}</span></a>`),
      );
    }
    const more = h(`<div class="list-card"></div>`);
    for (const x of sc.scenarios) {
      more.append(
        h(`<button class="list-btn" data-scenario="${x.id}"><span><span class="t">${esc(x.title)}</span><br /><span class="s">${esc(x.subtitle)}</span></span><span class="go" style="color:var(--muted)">${I.chev()}</span></button>`),
      );
    }
    $app.append(h(`<h2>All situations</h2>`), more);
    const note =
      a.plan === 'trial' && a.canStart
        ? `${a.remaining} free practice session${a.remaining === 1 ? '' : 's'} left`
        : a.plan === 'guest' && !a.canStart
          ? `<a href="#/login">Log in</a> to save your progress and keep practising.`
          : '';
    if (note) $app.append(h(`<p class="foot-note">${note}</p>`));
    if (me.mock) $app.append(h(`<p class="small center">Demo mode (MOCK_AI) — replies are canned.</p>`));
  }
  $app.querySelectorAll('[data-scenario]').forEach((b) =>
    b.addEventListener('click', () => {
      unlockAudio();
      go(`#/talk/${b.dataset.scenario}`);
    }),
  );
}

// ─── Conversation ────────────────────────────────────────────
async function renderTalk(scenarioId) {
  if (!state.me) await loadMe();
  $app.innerHTML = '';
  const wrap = h(`<div class="talk"></div>`);
  const head = h(`<div class="talk-head topbar">
      <button class="round-btn" data-exit aria-label="Leave conversation">${I.close()}</button>
      ${avatar()}
      <div class="meta"><div class="title">…</div><div class="role">Base</div></div>
      <button class="round-btn hf" data-hf aria-pressed="false" aria-label="Hands-free mode" title="Hands-free mode">${I.headset()}</button>
      <button class="pill" data-finish style="display:none">Finish</button>
    </div>`);
  const progress = h(`<div class="segments"></div>`);
  const thread = h(`<div class="thread"></div>`);
  wrap.append(head, progress, thread);
  $app.append(wrap);
  const headAvatar = head.querySelector('.avatar');

  const dock = h(`<div class="dock"><div class="dock-inner">
      <div class="hint" aria-live="polite">Getting ready…</div>
      <div class="dock-row">
        <div class="dock-side" data-left><button class="side-btn" data-type aria-label="Type instead">${I.keyboard()}</button></div>
        <div class="mic-halo"><button class="mic" disabled aria-label="Tap to speak">${MIC_SVG}<span class="ring"></span></button></div>
        <div class="dock-side" data-right></div>
      </div>
      <div class="sub">വാക്ക് കിട്ടുന്നില്ലേ? മലയാളത്തിൽ പറഞ്ഞോളൂ</div>
      <div data-typeslot style="width:100%"></div>
    </div></div>`);
  document.body.append(dock);
  const hint = dock.querySelector('.hint');
  const sub = dock.querySelector('.sub');
  const micBtn = dock.querySelector('.mic');
  const right = dock.querySelector('[data-right]');
  const left = dock.querySelector('[data-left]');
  const leftDefault = left.innerHTML;
  const typeSlot = dock.querySelector('[data-typeslot]');
  state.cleanup = () => {
    dock.remove();
    recorder.release();
  };

  const scrollDown = () => requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  const setHint = (text, cls = '') => {
    hint.textContent = text;
    hint.className = 'hint ' + cls;
  };
  const setProgress = (n, max) => {
    progress.innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  };

  // Conversation state
  let mode = 'reply'; // reply | retry | done
  let turn = 0;
  let pending = null; // turn result waiting for retry to complete
  let retryTarget = null;
  let attempts = 0;
  let fixCard = null;
  let micRef = null;
  let handsFree = prefs.get('handsFree', false);
  const hfBtn = head.querySelector('[data-hf]');
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
    toast(handsFree ? 'Hands-free on: I\'ll listen after I speak, and send when you pause.' : 'Hands-free off: tap the mic to talk.');
    if (handsFree && !micBtn.disabled && mode !== 'done') micRef?.start();
  });
  const autoListen = () => {
    if (handsFree && mode !== 'done' && !micBtn.disabled) micRef?.start();
  };

  let session;
  try {
    const r = await api('/sessions', { method: 'POST', body: { scenarioId } });
    session = r.session;
    head.querySelector('.title').textContent = session.title;
    head.querySelector('.role').textContent = `Base · ${session.partnerLabel || 'Partner'}`;
    setProgress(0, session.maxTurns);
    await addPartner(r.opener);
  } catch (e) {
    dock.remove();
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

  head.querySelector('[data-exit]').addEventListener('click', () => {
    if (turn > 0 && !confirm('Leave this conversation? Your mistakes so far are saved.')) return;
    if (turn > 0) finish();
    else go('#/');
  });
  head.querySelector('[data-finish]').addEventListener('click', () => finish());

  async function speakAs(text, opts) {
    headAvatar.classList.add('talking');
    await say(text, opts);
    headAvatar.classList.remove('talking');
  }

  async function addPartner(text, { play = true } = {}) {
    const b = h(`<div class="bubble partner"><div class="txt">${esc(text)}</div><button class="replay">${I.play()}Replay</button></div>`);
    b.querySelector('.replay').addEventListener('click', () => {
      unlockAudio();
      track('replay_partner', null, session.id);
      speakAs(text);
    });
    thread.append(b);
    scrollDown();
    setReady();
    if (play) speakAs(text).then(autoListen);
  }

  function setReady() {
    micBtn.disabled = false;
    micBtn.classList.toggle('retry', mode === 'retry');
    if (mode === 'retry') {
      setHint('Now say the sentence out loud', 'retry');
      sub.textContent = 'ഒരു തവണ ഉറക്കെ പറഞ്ഞാൽ മതി — accent നോക്കില്ല';
    } else {
      setHint(turn === 0 ? 'Tap the mic and answer. Take your time.' : 'Your turn. Pauses are okay.');
      sub.textContent = 'വാക്ക് കിട്ടുന്നില്ലേ? മലയാളത്തിൽ പറഞ്ഞോളൂ';
    }
  }

  function thinking(on) {
    micBtn.disabled = on;
    if (on) {
      thread.append(h(`<div class="bubble partner typing" data-typing><span class="dots"><span></span><span></span><span></span></span></div>`));
      scrollDown();
    } else thread.querySelector('[data-typing]')?.remove();
  }

  const mic = micControl(micBtn, {
    autoStop: () => handsFree,
    onState(st, sec) {
      if (st === 'recording') {
        setHint(mode === 'retry' ? 'Say it… tap stop when done' : 'Listening… pause as much as you need');
        right.innerHTML = `<span class="timer">0:00</span>`;
        left.innerHTML = `<button class="linkish" data-cancel>Cancel</button>`;
        left.querySelector('[data-cancel]').addEventListener('click', () => {
          mic.cancel();
          resetSides();
          setReady();
        });
      } else if (st === 'tick') {
        const t = right.querySelector('.timer');
        if (t) t.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      } else resetSides();
    },
    onAudio(out) {
      if (mode === 'retry') submitRetry(audioForm(out, { target: retryTarget, mistakeId: pending?.correction?.mistakeId, context: 'session', sessionId: session.id, attempt: attempts + 1 }));
      else submitTurn(audioForm(out));
    },
  });

  micRef = mic;

  function resetSides() {
    right.innerHTML = '';
    left.innerHTML = leftDefault;
    left.querySelector('[data-type]')?.addEventListener('click', openTyping);
  }
  left.querySelector('[data-type]').addEventListener('click', openTyping);

  // Typing fallback (no mic / testing / noisy bus)
  function openTyping() {
    if (typeSlot.querySelector('form')) return typeSlot.querySelector('input').focus();
    const f = h(`<form class="type-form"><input placeholder="Type what you would say…" autocomplete="off" aria-label="Your reply" /><button class="btn">Send</button></form>`);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = f.querySelector('input').value.trim();
      if (!v || micBtn.disabled) return;
      f.querySelector('input').value = '';
      const form = new FormData();
      form.append('text', v);
      if (mode === 'retry') {
        form.append('target', retryTarget);
        if (pending?.correction?.mistakeId) form.append('mistakeId', pending.correction.mistakeId);
        form.append('context', 'session');
        submitRetry(form);
      } else submitTurn(form);
    });
    typeSlot.append(f);
    f.querySelector('input').focus();
  }
  if (!Recorder.supported()) openTyping();

  async function submitTurn(form) {
    // Optimistic UI: the learner's bubble appears instantly while we transcribe.
    const mine = h(`<div class="bubble learner pending" aria-label="Sending your reply"><span class="wave"><i></i><i></i><i></i><i></i><i></i></span></div>`);
    thread.append(mine);
    scrollDown();
    micBtn.disabled = true;
    setHint('Listening back…');
    let r;
    const slow = setTimeout(() => {
      setHint('Thinking…');
      thinking(true);
    }, 1200);
    try {
      r = await api(`/sessions/${session.id}/turn`, { method: 'POST', form });
    } catch (e) {
      clearTimeout(slow);
      thinking(false);
      mine.remove();
      toast(e.message);
      setReady();
      return;
    }
    clearTimeout(slow);
    thinking(false);
    turn = r.turn;
    setProgress(turn, r.maxTurns);
    head.querySelector('[data-finish]').style.display = turn >= 2 ? '' : 'none';

    mine.classList.remove('pending');
    mine.removeAttribute('aria-label');
    mine.innerHTML = markMl(r.transcript);
    for (const w of r.lifeline) {
      thread.append(h(`<div class="word-card"><span class="ttl">NEW WORD</span><span class="from">${esc(w.said)}</span><span style="color:var(--gold-ink)">${I.arrow()}</span><span class="to">${esc(w.english)}</span></div>`));
    }
    scrollDown();

    if (r.correction) {
      pending = r;
      showFix(r.correction);
    } else {
      if (r.praise) thread.append(h(`<div class="praise">${I.check(16)} ${esc(r.praise)}</div>`));
      await continueAfter(r);
    }
  }

  function showFix(c) {
    mode = 'retry';
    attempts = 0;
    retryTarget = c.sayItLikeThis;
    fixCard = h(`<div class="fix-card">
      <div class="kasavu wide"></div>
      <div class="top"><span class="tag">${c.kind === 'word' ? 'Say it in English' : 'One small fix'}</span>
        <span class="fb">Clear? <button data-fb="1" aria-label="Yes, clear">${I.thumb()}</button><button data-fb="0" aria-label="Not clear">${I.thumb(18, true)}</button></span></div>
      ${c.kind !== 'word' ? `<div><div class="lbl">You said</div><div class="said">${esc(c.youSaid)}</div></div>` : ''}
      <div><div class="lbl g">Say it like this</div><div class="right">${esc(c.sayItLikeThis)}</div></div>
      <div class="why">${avatar('sm')}<span>${esc(c.explanationMl)}</span></div>
      ${c.repeated ? `<div class="repeat">This one has come up ${c.timesMade} times — it's in your Mistake Bank.</div>` : ''}
      <div class="actions"><button class="btn outline" data-listen>${I.speaker(18)}Hear it slowly</button></div>
      <div data-result></div>
    </div>`);
    fixCard.querySelector('[data-listen]').addEventListener('click', () => {
      track('replay_correction', null, session.id);
      speakAs(c.sayItLikeThis, { slow: true });
    });
    fixCard.querySelectorAll('[data-fb]').forEach((b) =>
      b.addEventListener('click', () => {
        fixCard.querySelectorAll('[data-fb]').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        track('correction_feedback', { helpful: b.dataset.fb === '1', mistakeId: c.mistakeId }, session.id);
        toast(b.dataset.fb === '1' ? 'Thanks!' : 'Thanks — we will make these clearer.');
      }),
    );
    thread.append(fixCard);
    scrollDown();
    setReady();
    speakAs(c.sayItLikeThis, { slow: true }).then(autoListen);
  }

  async function submitRetry(form) {
    micBtn.disabled = true;
    setHint('Checking…');
    const result = fixCard.querySelector('[data-result]');
    let r;
    try {
      r = await api('/retry', { method: 'POST', form });
    } catch (e) {
      toast(e.message);
      setReady();
      return;
    }
    attempts++;
    if (r.pass) {
      fixCard.classList.add('passed');
      result.innerHTML = `<div class="retry-result ok">${I.check(18)} You said it! <span class="heard">“${esc(r.transcript)}”</span></div>`;
      celebrate(r.mastery?.justMastered ? 'Mistake mastered!' : 'Perfect!');
      mode = 'reply';
      scrollDown();
      await sleep(1100);
      const p = pending;
      pending = null;
      await continueAfter(p);
    } else {
      const missing = r.missing?.length ? ` Listen for: <span class="missing">${r.missing.map(esc).join(', ')}</span>` : '';
      result.innerHTML = `<div class="retry-result no">Almost! Try once more.${missing}<span class="heard">We heard: “${esc(r.transcript)}”</span></div>`;
      if (attempts >= 2 && !fixCard.querySelector('[data-skip]')) {
        const skip = h(`<button class="linkish" data-skip>Move on for now — it's saved in your Mistake Bank</button>`);
        skip.addEventListener('click', async () => {
          track('retry_skipped', { attempts }, session.id);
          skip.remove();
          mode = 'reply';
          const p = pending;
          pending = null;
          await continueAfter(p);
        });
        result.append(skip);
      }
      scrollDown();
      setReady();
    }
  }

  async function continueAfter(r) {
    if (r.done) {
      mode = 'done';
      thread.append(h(`<div class="bubble partner"><div class="txt">${esc(r.reply)}</div></div>`));
      micBtn.disabled = true;
      setHint('Great job!');
      sub.textContent = '';
      typeSlot.innerHTML = '';
      const btn = h(`<button class="btn block gold">See what you learned ${I.arrow()}</button>`);
      typeSlot.append(btn);
      btn.addEventListener('click', finish);
      scrollDown();
      speakAs(r.reply);
      return;
    }
    await addPartner(r.reply);
  }

  let finishing = false;
  async function finish() {
    if (finishing) return;
    finishing = true;
    mic.cancel();
    stopSpeaking();
    dock.remove();
    $app.innerHTML = '';
    $app.append(emptyState(I.sparkle(), 'One moment…', 'Putting together what you learned.'));
    try {
      const r = await api(`/sessions/${session.id}/end`, { method: 'POST' });
      await loadMe();
      renderSummary(r, scenarioId);
    } catch (e) {
      toast(e.message);
      go('#/');
    }
  }
}

function renderSummary(r, scenarioId) {
  $app.innerHTML = '';
  const sec = Math.round(r.secondsSpoken);
  const big = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}<small>min</small>` : `${sec}<small>sec</small>`;
  const seen = new Set();
  const words = r.words.filter((w) => !seen.has(w.english.toLowerCase()) && seen.add(w.english.toLowerCase()));
  const hero = h(`<section class="sum-hero">
      <div class="topbar" style="background:none;padding:0;position:static">
        <a class="brand" href="#/" style="color:var(--cream)"><span class="wordmark">base<i>.</i></span></a><span class="spacer"></span>
        <span class="pill gold">${I.flame()} ${r.stats.streak} day${r.stats.streak === 1 ? '' : 's'}</span>
      </div>
      <div class="eyebrow">YOU SPOKE ENGLISH OUT LOUD FOR</div>
      <div class="big">${big}</div>
      <div class="nums"><span><b>${r.turns}</b> replies</span><span><b>${r.mistakes.length}</b> fix${r.mistakes.length === 1 ? '' : 'es'}</span><span><b>${words.length}</b> new word${words.length === 1 ? '' : 's'}</span></div>
    </section>`);
  $app.append(hero);
  if (r.coachNote) $app.append(h(`<p class="coach-note">${esc(r.coachNote)}</p>`));

  if (r.mistakes.length || words.length) {
    const card = h(`<div class="card" style="margin-top:16px"><div class="display" style="font-weight:700;font-size:16px;margin-bottom:4px">Today's fixes</div></div>`);
    for (const m of r.mistakes) {
      card.append(h(`<div class="fix-line"><span class="tick" style="color:var(--cream)">${I.check()}</span><div><div class="r">${esc(m.corrected)}</div><div class="w">${esc(m.explanationMl)}</div></div></div>`));
    }
    if (words.length) {
      card.append(
        h(`<div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px dashed var(--line);padding-top:12px;margin-top:6px">${words
          .map((w) => `<span class="word-chip">${esc(w.said)} → <b>${esc(w.english)}</b></span>`)
          .join('')}</div>`),
      );
    }
    $app.append(card);
  } else if (r.turns) {
    $app.append(h(`<div class="card center" style="margin-top:16px"><b>No corrections needed</b> — very natural English!</div>`));
  }

  if (r.needLogin) {
    track('login_prompt_shown', { from: 'summary' });
    const card = h(`<div class="card dark save-card">
      <div class="kasavu"></div>
      <h3>Keep your Mistake Bank &amp; streak</h3>
      <p>One-tap login with your phone or WhatsApp. Unlocks your free practice sessions.</p>
      <button class="btn block gold" data-login>Continue with WhatsApp ${I.arrow()}</button>
      <button class="btn ghost block" data-skip style="color:#b9c8c3">Maybe later</button>
    </div>`);
    card.querySelector('[data-login]').addEventListener('click', () => {
      sessionStorage.setItem('afterLogin', '#/bank');
      go('#/login');
    });
    card.querySelector('[data-skip]').addEventListener('click', () => {
      track('login_skipped');
      card.remove();
    });
    $app.append(card);
  }
  const actions = h(`<div class="stack" style="margin-top:20px">
    ${r.turns ? `<button class="btn block outline" data-share style="min-height:52px;border-radius:16px">${I.share()} Share my progress</button>` : ''}
    <button class="btn block" data-again>Practise again</button>
    <button class="btn block secondary" data-home>Back to home</button>
  </div>`);
  actions.querySelector('[data-again]').addEventListener('click', () => go(`#/talk/${scenarioId}`));
  actions.querySelector('[data-share]')?.addEventListener('click', () => shareProgress(r, words));
  actions.querySelector('[data-home]').addEventListener('click', () => go('#/'));
  $app.append(actions);
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
async function renderWarmup() {
  const { items } = await api('/warmup');
  if (!state.me) await loadMe();
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
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
    const r = await api('/warmup/done', { method: 'POST', body: { passed, total: items.length } }).catch(() => null);
    if (r) state.me.stats = r.stats;
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
        stepCode(r.phone, r.provider);
      } catch (err) {
        f.querySelector('.err').textContent = err.message;
        btn.disabled = false;
      }
    });
    box.append(f);
    f.querySelector('input').focus();
  };

  const stepCode = (phone, provider) => {
    box.innerHTML = '';
    const f = h(`<form>
      <h1>Enter the code</h1>
      <p class="lead">Sent to ${esc(phone)}. ${provider === 'console' ? '<br/><span class="small">(Pilot mode: the code is in the server log.)</span>' : ''}</p>
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
    const f = profileForm(state.me.user, 'Tell Base about you', 'So every conversation feels like catching up with a coach who knows you. (Optional)', 'Save & continue');
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
    <label class="lbl" for="jr">What do you do?</label>
    <input class="input" id="jr" name="jobRole" value="${esc(u.jobRole || '')}" placeholder="e.g. Software tester, Nursing student" />
    <label class="lbl">Why are you practising?</label>
    <div class="row" style="flex-wrap:wrap;gap:8px" data-goals>${goals.map((g) => `<button type="button" class="chip ${u.goals === g ? 'on' : ''}">${esc(g)}</button>`).join('')}</div>
    <div class="err"></div>
    <button class="btn block" style="margin-top:8px">${esc(cta)}</button>
  </form>`);
  let goal = u.goals || '';
  f.querySelector('[data-goals]').addEventListener('click', (e) => {
    if (!e.target.classList.contains('chip')) return;
    f.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
    e.target.classList.add('on');
    goal = e.target.textContent;
  });
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
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  const u = state.me.user;
  const a = state.me.allowance;
  $app.append(h(`<h1>Settings</h1>`));

  const plan = h(`<div class="card dark"><div class="kasavu"></div><div class="display" style="font-weight:700;font-size:18px;margin-top:10px">Your plan</div><p style="margin:4px 0 12px;color:#b9c8c3;font-size:14px">${
    a.plan === 'paid' ? 'Monthly pass — active' : a.canStart ? `Free trial · ${a.remaining} session${a.remaining === 1 ? '' : 's'} left` : 'Free trial finished'
  }</p>${a.plan === 'paid' ? `<a class="btn outline" style="color:var(--cream);border-color:var(--cream)" href="${esc(state.me.upgrade.url || '#')}" target="_blank" rel="noopener">Manage subscription</a>` : `<a class="btn gold" href="#/upgrade">See the monthly pass</a>`}</div>`);
  $app.append(plan);

  $app.append(h(`<h2>Daily practice</h2>`));
  const gf = goalForm(u, { cta: 'Save' });
  gf.addEventListener('saved', () => toast('Saved'));
  $app.append(gf);

  $app.append(h(`<h2>About you</h2>`));
  const pf = profileForm(u, '', '', 'Save');
  pf.querySelector('h1')?.remove();
  pf.querySelector('.lead')?.remove();
  pf.addEventListener('saved', () => toast('Saved'));
  $app.append(pf);

  $app.append(h(`<h2>More</h2>`));
  const links = h(`<div class="list-card">
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
  const text = `I'm practising spoken English with Base — a patient partner, and you can use Malayalam words when you get stuck. Try it free: ${inv.url}`;
  const box = h(`<section>
    <div class="invite-art">${I.gift(44)}</div>
    <h1 class="center">Practise together</h1>
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
    <h1>Keep the habit going</h1>
    <p class="lead">In your free sessions you spoke for <b>${s.minutesSpoken} minutes</b> and fixed <b>${s.mistakesMastered}</b> old mistakes.</p>
    <div class="card dark stack">
      <div class="kasavu"></div>
      <div class="display" style="font-size:26px;font-weight:800;letter-spacing:-0.02em">Monthly pass · <span style="color:var(--gold)">${esc(state.me.upgrade.price)}</span></div>
      <div class="fix-line"><span class="tick" style="background:var(--gold);color:var(--ink)">${I.check()}</span><span>Daily speaking practice</span></div>
      <div class="fix-line" style="margin-top:0"><span class="tick" style="background:var(--gold);color:var(--ink)">${I.check()}</span><span>Your personal Mistake Bank &amp; warm-ups</span></div>
      <div class="fix-line" style="margin-top:0"><span class="tick" style="background:var(--gold);color:var(--ink)">${I.check()}</span><span>A partner who remembers you</span></div>
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
  x.fillText('Practise with me — free', 110, 1170);
  x.font = '700 38px Manrope, sans-serif';
  x.fillText(url.replace(/^https?:\/\//, ''), 110, 1235);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'my-english-progress.png', { type: 'image/png' });
  const text = `I spoke English out loud for ${big} ${sec >= 60 ? 'min' : 'sec'} today with Base! Practise with me: ${url}`;
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

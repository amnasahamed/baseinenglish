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

function celebrate(text = 'Perfect!', ml = 'നന്നായി! 👏') {
  const box = document.getElementById('celebrate');
  box.innerHTML = '';
  const bits = ['🎉', '⭐', '✨', '👏', '🌟', '💪'];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 120 + Math.random() * 80;
    const b = h(`<span class="bit">${bits[i % bits.length]}</span>`);
    b.style.setProperty('--x', `${Math.cos(a) * r}px`);
    b.style.setProperty('--y', `${Math.sin(a) * r}px`);
    b.style.setProperty('--r', `${Math.random() * 360}deg`);
    box.appendChild(b);
  }
  box.appendChild(h(`<div class="msg">${esc(text)}<span class="ml">${esc(ml)}</span></div>`));
  if (navigator.vibrate) navigator.vibrate(40);
  setTimeout(() => (box.innerHTML = ''), 1600);
}

const MIC_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>`;
const STOP_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="3"/></svg>`;

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
function micControl(btn, { onAudio, onState, maxSec = 120 }) {
  let recording = false;
  let timer;
  const ring = btn.querySelector('.ring');
  const setUi = (state) => {
    recording = state === 'recording';
    btn.classList.toggle('recording', recording);
    btn.innerHTML = (recording ? STOP_SVG : MIC_SVG) + (ring ? '<span class="ring"></span>' : '');
    btn.setAttribute('aria-label', recording ? 'Stop and send' : 'Tap to speak');
    onState?.(state);
  };
  btn.addEventListener('click', async () => {
    unlockAudio();
    if (btn.disabled) return;
    if (!recording) {
      stopSpeaking();
      try {
        await recorder.start((lvl) => btn.querySelector('.ring')?.style.setProperty('--lvl', String(1 + lvl * 0.5)));
      } catch (e) {
        toast(e.name === 'NotAllowedError' ? 'Please allow microphone access to practise speaking 🎙️' : 'Could not start the microphone.');
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
        toast('Tap once to start, speak, then tap again when you are done 🙂');
        return;
      }
      onAudio(out);
    }
  });
  return {
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
  [/^#\/profile$/, renderProfile],
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
        $app.append(h(`<div class="empty"><div class="e">😕</div><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Try again</button></div>`));
      }
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
  const el = h(`<header class="topbar">
    ${back ? `<button class="back" data-back>← Back</button>` : `<a class="brand" href="#/"><img src="/icon.svg" alt="" />Base in English</a>`}
    <span class="spacer"></span>
    ${streak ? `<span class="pill" title="Days in a row">🔥 ${streak}</span>` : ''}
    ${me?.user?.isGuest ? `<a class="pill" href="#/login" style="text-decoration:none;color:inherit">Log in</a>` : `<a class="icon-btn" href="#/profile" aria-label="Your profile" style="text-decoration:none">👤</a>`}
  </header>`);
  el.querySelector('[data-back]')?.addEventListener('click', () => (history.length > 1 ? history.back() : go('#/')));
  return el;
}

// ─── Home ────────────────────────────────────────────────────
async function renderHome() {
  const [me, sc] = await Promise.all([loadMe(), state.scenarios || api('/scenarios')]);
  state.scenarios = sc;
  const s = me.stats;
  const isNew = s.sessionsDone === 0;
  $app.innerHTML = '';
  $app.append(topbar());

  const startScenario = (id) => go(`#/talk/${id}`);
  const catButtons = sc.categories
    .map(
      (c) => `<button class="big-choice" data-scenario="${c.defaultScenario}">
        <span class="emoji">${c.emoji}</span>
        <span><span class="t">${esc(c.title)}</span><br /><span class="s">${esc(c.titleMl)}</span></span>
        <span class="chev">›</span></button>`,
    )
    .join('');

  if (isNew) {
    $app.append(
      h(`<section class="hero">
        <h1 class="ml">English മനസ്സിലാകും,<br />പക്ഷേ സംസാരിക്കാൻ മടിയാണോ?</h1>
        <p class="lead">Practise speaking with a patient partner. Take your time — no one will cut you off.</p>
        <div class="stack">${catButtons}</div>
        <div class="lifeline-banner"><span class="e">🛟</span><div class="ml"><b>Stuck on a word? Just say it in Malayalam.</b>ഒരു വാക്ക് കിട്ടുന്നില്ലെങ്കിൽ മലയാളത്തിൽ പറഞ്ഞോളൂ — ഞങ്ങൾ English വാക്ക് പഠിപ്പിച്ചു തരാം.</div></div>
        <h2>How it works</h2>
        <div class="how">
          <div class="step"><span class="n">1</span><div><b>Tap the mic & talk.</b> <span class="small">Pause as much as you need. Tap again to send.</span></div></div>
          <div class="step"><span class="n">2</span><div><b>Get one clear fix</b> <span class="small">— explained in simple Malayalam.</span></div></div>
          <div class="step"><span class="n">3</span><div><b>Say it again, out loud.</b> <span class="small">That's how your mouth learns it.</span></div></div>
        </div>
        <p class="small center" style="margin-top:22px">Free · No signup needed to try</p>
      </section>`),
    );
  } else {
    const name = me.user.name ? `, ${esc(me.user.name.split(' ')[0])}` : '';
    const week = s.week
      .map((d) => {
        const wd = new Date(d.day + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'narrow' });
        return `<div class="d"><div class="dot ${d.practiced ? 'on' : ''}">${d.practiced ? '🔥' : ''}</div>${wd}</div>`;
      })
      .join('');
    const a = me.allowance;
    const allowanceNote =
      a.plan === 'trial' && a.canStart
        ? `<p class="small center">${a.remaining} free practice session${a.remaining === 1 ? '' : 's'} left</p>`
        : a.plan === 'guest' && !a.canStart
          ? `<p class="small center"><a href="#/login">Log in</a> to save your progress and keep practising.</p>`
          : '';
    $app.append(
      h(`<section>
        <h1>Hi${name} 👋</h1>
        <p class="lead" style="margin-bottom:14px">${s.practicedToday ? 'Nice — you practised today. One more?' : 'Ready for a few minutes of speaking?'}</p>
        <div class="card">
          <div class="stats">
            <div class="stat"><div class="v">${s.daysPracticed}</div><div class="l">days practised</div></div>
            <div class="stat"><div class="v">${s.minutesSpoken}</div><div class="l">minutes spoken out loud</div></div>
            <div class="stat"><div class="v">${s.mistakesMastered}</div><div class="l">old mistakes fixed</div></div>
          </div>
          <div class="week">${week}</div>
        </div>
      </section>`),
    );
    if (me.warmup.due) {
      $app.append(
        h(`<a class="card feature-card warm" href="#/warmup" style="margin-top:14px">
          <span class="emoji">⚡</span>
          <span><b>2-minute warm-up</b><br /><span class="small">Fix ${me.warmup.pending} of your own past mistakes</span></span>
          <span style="margin-left:auto">›</span></a>`),
      );
    }
    if (s.mistakesTotal) {
      $app.append(
        h(`<a class="card feature-card" href="#/bank" style="margin-top:12px">
          <span class="emoji">📒</span>
          <span><b>Your Mistake Bank</b><br /><span class="small">${s.mistakesTotal - s.mistakesMastered} to practise · ${s.mistakesMastered} mastered</span></span>
          <span style="margin-left:auto;color:var(--muted)">›</span></a>`),
      );
    }
    $app.append(h(`<h2>Start speaking</h2>`));
    $app.append(h(`<div class="stack">${catButtons}</div>`));
    const more = h(`<div class="card" style="margin-top:14px;padding:4px 16px"></div>`);
    for (const x of sc.scenarios) {
      more.append(
        h(`<button class="list-btn" data-scenario="${x.id}"><span><span class="t">${esc(x.title)}</span><br /><span class="s">${esc(x.subtitle)}</span></span><span class="chev">›</span></button>`),
      );
    }
    $app.append(h(`<h2>All situations</h2>`), more);
    if (allowanceNote) $app.append(h(`<div style="margin-top:12px">${allowanceNote}</div>`));
    if (me.mock) $app.append(h(`<p class="small center">⚙️ Demo mode (MOCK_AI) — replies are canned.</p>`));
  }
  $app.querySelectorAll('[data-scenario]').forEach((b) =>
    b.addEventListener('click', () => {
      unlockAudio();
      startScenario(b.dataset.scenario);
    }),
  );
}

// ─── Conversation ────────────────────────────────────────────
async function renderTalk(scenarioId) {
  if (!state.me) await loadMe();
  $app.innerHTML = '';
  const wrap = h(`<div class="talk"></div>`);
  const head = h(`<div class="talk-head topbar">
      <button class="back" data-exit>✕</button>
      <span class="title">…</span>
      <button class="pill" data-finish style="display:none">Finish</button>
    </div>`);
  const progress = h(`<div class="progress"><i style="width:4%"></i></div>`);
  const thread = h(`<div class="thread"></div>`);
  wrap.append(head, progress, thread);
  $app.append(wrap);

  const dock = h(`<div class="dock"><div class="dock-inner">
      <div class="hint">Getting ready…</div>
      <div class="dock-row">
        <div class="dock-side" data-left></div>
        <button class="mic" disabled aria-label="Tap to speak">${MIC_SVG}<span class="ring"></span></button>
        <div class="dock-side" data-right></div>
      </div>
      <div class="sub ml">🛟 Stuck? ആ വാക്ക് മലയാളത്തിൽ പറഞ്ഞോളൂ</div>
      <div data-type style="width:100%"></div>
    </div></div>`);
  document.body.append(dock);
  const hint = dock.querySelector('.hint');
  const sub = dock.querySelector('.sub');
  const micBtn = dock.querySelector('.mic');
  const right = dock.querySelector('[data-right]');
  const left = dock.querySelector('[data-left]');
  const typeSlot = dock.querySelector('[data-type]');
  state.cleanup = () => {
    dock.remove();
    recorder.release();
  };

  const scrollDown = () => requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  const setHint = (text, cls = '') => {
    hint.textContent = text;
    hint.className = 'hint ' + cls;
  };

  // Conversation state
  let mode = 'reply'; // reply | retry | done
  let turn = 0;
  let pending = null; // turn result waiting for retry to complete
  let retryTarget = null;
  let attempts = 0;
  let fixCard = null;

  // Start the session
  let session;
  try {
    const r = await api('/sessions', { method: 'POST', body: { scenarioId } });
    session = r.session;
    head.querySelector('.title').textContent = session.title;
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

  async function addPartner(text, { play = true } = {}) {
    const b = h(`<div class="bubble partner"><div class="who">Partner <button class="replay" aria-label="Play again">🔊 Replay</button></div><div class="txt">${esc(text)}</div></div>`);
    b.querySelector('.replay').addEventListener('click', () => {
      unlockAudio();
      track('replay_partner', null, session.id);
      say(text);
    });
    thread.append(b);
    scrollDown();
    setReady();
    if (play) say(text);
  }

  function setReady() {
    micBtn.disabled = false;
    micBtn.classList.toggle('retry', mode === 'retry');
    if (mode === 'retry') {
      setHint('Now tap the mic and say the green sentence out loud 👇', 'retry');
      sub.textContent = 'ശരിയായ വാചകം ഒരു തവണ ഉറക്കെ പറയൂ';
    } else {
      setHint(turn === 0 ? 'Tap the mic and answer. Take your time.' : 'Your turn — tap the mic when ready');
      sub.textContent = '🛟 Stuck? ആ വാക്ക് മലയാളത്തിൽ പറഞ്ഞോളൂ';
    }
  }

  function thinking(on) {
    micBtn.disabled = on;
    if (on) {
      const t = h(`<div class="bubble partner typing" data-typing><span class="dots"><span></span><span></span><span></span></span></div>`);
      thread.append(t);
      scrollDown();
    } else thread.querySelector('[data-typing]')?.remove();
  }

  const mic = micControl(micBtn, {
    onState(st, sec) {
      if (st === 'recording') {
        setHint(mode === 'retry' ? 'Say the sentence… tap ■ when done' : 'Listening… pause as much as you need. Tap ■ to send.');
        right.innerHTML = `<span class="timer">0:00</span>`;
        left.innerHTML = `<button class="linkish" data-cancel>Cancel</button>`;
        left.querySelector('[data-cancel]').addEventListener('click', () => {
          mic.cancel();
          left.innerHTML = right.innerHTML = '';
          setReady();
        });
      } else if (st === 'tick') {
        const t = right.querySelector('.timer');
        if (t) t.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      } else {
        left.innerHTML = right.innerHTML = '';
      }
    },
    onAudio(out) {
      if (mode === 'retry') submitRetry(audioForm(out, { target: retryTarget, mistakeId: pending?.correction?.mistakeId, context: 'session', sessionId: session.id, attempt: attempts + 1 }));
      else submitTurn(audioForm(out));
    },
  });

  // Typing fallback (no mic / testing / noisy bus)
  const typeToggle = h(`<button class="linkish">⌨️ Can't speak right now? Type instead</button>`);
  typeSlot.append(typeToggle);
  typeToggle.addEventListener('click', () => {
    typeSlot.innerHTML = '';
    const f = h(`<form class="type-form"><input placeholder="Type what you would say…" autocomplete="off" /><button class="btn" style="min-height:44px">Send</button></form>`);
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
  });
  if (!Recorder.supported()) typeToggle.click();

  async function submitTurn(form) {
    thinking(true);
    setHint('Thinking…');
    let r;
    try {
      r = await api(`/sessions/${session.id}/turn`, { method: 'POST', form });
    } catch (e) {
      thinking(false);
      toast(e.message);
      setReady();
      return;
    }
    thinking(false);
    turn = r.turn;
    progress.firstElementChild.style.width = `${Math.min(100, (turn / r.maxTurns) * 100)}%`;
    head.querySelector('[data-finish]').style.display = turn >= 2 ? '' : 'none';

    thread.append(h(`<div class="bubble learner">${esc(r.transcript)}</div>`));
    for (const w of r.lifeline) {
      thread.append(
        h(`<div class="word-card"><div class="ttl">🛟 New word for you</div><div class="pair ml">${esc(w.said)} → <b>${esc(w.english)}</b></div></div>`),
      );
    }
    scrollDown();

    if (r.correction) {
      pending = r;
      showFix(r.correction);
    } else {
      if (r.praise) thread.append(h(`<div class="praise">✓ ${esc(r.praise)}</div>`));
      await continueAfter(r);
    }
  }

  function showFix(c) {
    mode = 'retry';
    attempts = 0;
    retryTarget = c.sayItLikeThis;
    fixCard = h(`<div class="fix-card">
      <span class="tag">${c.kind === 'word' ? '🛟 Say it in English' : '💡 One small fix'}</span>
      ${c.kind !== 'word' ? `<div class="said">You said: <s>${esc(c.youSaid)}</s></div>` : ''}
      <div class="right">✅ ${esc(c.sayItLikeThis)}</div>
      <div class="why">${esc(c.explanationMl)}</div>
      ${c.repeated ? `<div class="repeat">🔁 This one came up ${c.timesMade} times — it's in your Mistake Bank.</div>` : ''}
      <div class="actions">
        <button class="btn secondary" style="min-height:40px;padding:8px 12px" data-listen>🔊 Listen</button>
        <span class="feedback">Clear? <button data-fb="1" aria-label="Yes, clear">👍</button><button data-fb="0" aria-label="Not clear">👎</button></span>
      </div>
      <div data-result></div>
    </div>`);
    fixCard.querySelector('[data-listen]').addEventListener('click', () => {
      track('replay_correction', null, session.id);
      say(c.sayItLikeThis, { slow: true });
    });
    fixCard.querySelectorAll('[data-fb]').forEach((b) =>
      b.addEventListener('click', () => {
        fixCard.querySelectorAll('[data-fb]').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        track('correction_feedback', { helpful: b.dataset.fb === '1', mistakeId: c.mistakeId }, session.id);
        toast(b.dataset.fb === '1' ? 'Thanks! 🙏' : 'Thanks — we will make these clearer.');
      }),
    );
    thread.append(fixCard);
    scrollDown();
    setReady();
    // Model the sentence once so they hear it before saying it.
    say(c.sayItLikeThis, { slow: true });
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
      result.innerHTML = `<div class="retry-result ok">🎉 You said it! <span class="heard">“${esc(r.transcript)}”</span></div>`;
      celebrate(r.mastery?.justMastered ? 'Mistake mastered!' : 'Perfect!', 'നന്നായി! അങ്ങനെ തന്നെ 👏');
      mode = 'reply';
      scrollDown();
      await sleep(1100);
      const p = pending;
      pending = null;
      await continueAfter(p);
    } else {
      const missing = r.missing?.length ? ` Listen for: <span class="missing">${r.missing.map(esc).join(', ')}</span>` : '';
      result.innerHTML = `<div class="retry-result no">Almost! Try once more 💪${missing}<span class="heard">We heard: “${esc(r.transcript)}”</span></div>`;
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
      const b = h(`<div class="bubble partner"><div class="who">Partner</div><div class="txt">${esc(r.reply)}</div></div>`);
      thread.append(b);
      micBtn.disabled = true;
      setHint('Great job! 🎉');
      sub.textContent = '';
      typeSlot.innerHTML = '';
      const btn = h(`<button class="btn block accent">See what you learned →</button>`);
      typeSlot.append(btn);
      btn.addEventListener('click', finish);
      scrollDown();
      say(r.reply);
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
    $app.innerHTML = `<div class="empty"><div class="e">✨</div><p>Putting together your summary…</p></div>`;
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
  $app.append(topbar());
  const mins = r.secondsSpoken >= 60 ? `${Math.round(r.secondsSpoken / 6) / 10} min` : `${Math.round(r.secondsSpoken)} sec`;
  $app.append(
    h(`<section class="summary-hero">
      <div class="big">🎉</div>
      <h1>You spoke English out loud!</h1>
      <p class="lead">${r.turns} replies · ${mins} of speaking · 🔥 ${r.stats.streak}-day streak</p>
    </section>`),
  );
  if (r.coachNote) $app.append(h(`<div class="coach-note">${esc(r.coachNote)}</div>`));

  if (r.needLogin) {
    track('login_prompt_shown', { from: 'summary' });
    const card = h(`<div class="card" style="margin-top:16px;border:2px solid var(--brand-2)">
      <b style="font-size:18px">💾 Save your Mistake Bank</b>
      <p class="small" style="margin:6px 0 12px">Log in with your phone number to keep your ${r.mistakes.length || ''} personal mistake${r.mistakes.length === 1 ? '' : 's'}, your streak, and unlock your free practice sessions.</p>
      <button class="btn block whatsapp">Continue with phone / WhatsApp</button>
      <button class="btn ghost block" data-skip style="margin-top:4px">Maybe later</button>
    </div>`);
    card.querySelector('.whatsapp').addEventListener('click', () => {
      sessionStorage.setItem('afterLogin', '#/bank');
      go('#/login');
    });
    card.querySelector('[data-skip]').addEventListener('click', () => {
      track('login_skipped');
      card.remove();
    });
    $app.append(card);
  }

  if (r.words.length) {
    const seen = new Set();
    const items = r.words.filter((w) => !seen.has(w.english.toLowerCase()) && seen.add(w.english.toLowerCase()));
    $app.append(h(`<h2>🛟 Words you learned</h2>`));
    $app.append(
      h(`<div class="card">${items.map((w) => `<div class="mini-mistake ml">${esc(w.said)} → <b>${esc(w.english)}</b></div>`).join('')}</div>`),
    );
  }
  if (r.mistakes.length) {
    $app.append(h(`<h2>💡 Your fixes today</h2>`));
    $app.append(
      h(`<div class="card">${r.mistakes
        .map((m) => `<div class="mini-mistake"><div class="right">✅ ${esc(m.corrected)}</div><div class="why">${esc(m.explanationMl)}</div></div>`)
        .join('')}</div>`),
    );
    $app.append(h(`<p class="small center">These are saved in your Mistake Bank. We'll bring them back in a quick warm-up so the habit sticks.</p>`));
  } else if (r.turns) {
    $app.append(h(`<div class="card center" style="margin-top:16px">🌟 No corrections needed this time — very natural English!</div>`));
  }
  const actions = h(`<div class="stack" style="margin-top:20px">
    <button class="btn block" data-again>Practise again</button>
    <button class="btn block secondary" data-home>Back to home</button>
  </div>`);
  actions.querySelector('[data-again]').addEventListener('click', () => go(`#/talk/${scenarioId}`));
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
  $app.append(h(`<h1>📒 Mistake Bank</h1>`));
  $app.append(h(`<p class="lead">Your own mistakes. Say each one right ${mistakes[0]?.target || 3} times to master it.</p>`));
  if (state.me.user.isGuest && mistakes.length) {
    $app.append(h(`<div class="card" style="margin-bottom:12px"><b>Don't lose these!</b> <a href="#/login" onclick="sessionStorage.setItem('afterLogin','#/bank')">Log in with your phone</a> to save them.</div>`));
  }
  if (!mistakes.length) {
    $app.append(h(`<div class="empty"><div class="e">🌱</div><p>No mistakes yet. Have a conversation and your personal fixes will appear here.</p><a class="btn" href="#/">Start speaking</a></div>`));
    return;
  }
  const tabs = h(`<div class="tabs"><button class="on" data-t="open">To practise (${open.length})</button><button data-t="done">Mastered (${done.length})</button></div>`);
  const list = h(`<div class="stack"></div>`);
  $app.append(tabs, list);
  const show = (which) => {
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === which));
    list.innerHTML = '';
    const items = which === 'open' ? open : done;
    if (!items.length) list.append(h(`<div class="empty"><div class="e">${which === 'open' ? '🏆' : '🌱'}</div><p>${which === 'open' ? 'All mastered. Amazing!' : 'Nothing mastered yet — keep practising!'}</p></div>`));
    for (const m of items) list.append(bankCard(m));
  };
  tabs.addEventListener('click', (e) => e.target.dataset.t && show(e.target.dataset.t));
  show('open');
  state.cleanup = () => recorder.release();
}

function pips(m) {
  return `<span class="pips" title="${m.timesSpokenRight}/${m.target} said right">${Array.from({ length: m.target }, (_, i) => `<i class="${i < m.timesSpokenRight ? 'on' : ''}"></i>`).join('')}</span>`;
}

function bankCard(m) {
  const card = h(`<div class="card bank-card">
    <div class="label">${esc(m.label)}</div>
    ${m.kind !== 'word' ? `<div class="wrong">✗ <s>${esc(m.wrong)}</s></div>` : ''}
    <div class="right">✅ ${esc(m.corrected)}</div>
    <div class="why">${esc(m.explanationMl)}</div>
    <div class="meta">
      <button class="mini-mic" aria-label="Say it">${MIC_SVG}</button>
      <button class="btn secondary" style="min-height:40px;padding:8px 12px" data-listen>🔊</button>
      <span data-pips>${pips(m)}</span>
      ${m.mastered ? `<span class="badge done">Mastered</span>` : m.timesMade > 1 ? `<span class="badge made">Made ${m.timesMade}×</span>` : ''}
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
    async onAudio(out) {
      btn.disabled = true;
      res.innerHTML = `<div class="small" style="margin-top:8px">Checking…</div>`;
      try {
        const r = await api('/retry', { method: 'POST', form: audioForm(out, { target: m.corrected, mistakeId: m.id, context: 'bank' }) });
        if (r.pass) {
          if (r.mastery) {
            m.timesSpokenRight = r.mastery.timesSpokenRight;
            card.querySelector('[data-pips]').innerHTML = pips(m);
          }
          res.innerHTML = `<div class="retry-result ok">${r.mastery?.justMastered ? '🏆 Mastered!' : '🎉 Perfect!'}</div>`;
          celebrate(r.mastery?.justMastered ? 'Mistake mastered!' : 'Perfect!');
        } else {
          res.innerHTML = `<div class="retry-result no">Almost! Try again 💪<span class="heard">We heard: “${esc(r.transcript)}”</span></div>`;
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
    $app.append(h(`<div class="empty"><div class="e">🌱</div><p>Nothing to warm up yet. Have a conversation first!</p><a class="btn" href="#/">Start speaking</a></div>`));
    return;
  }
  state.cleanup = () => recorder.release();
  let i = 0;
  let passed = 0;
  const box = h(`<div></div>`);
  $app.append(h(`<h1>⚡ Warm-up</h1>`), h(`<p class="lead">Your own past mistakes. Say each one the right way.</p>`), box);

  const next = () => {
    if (i >= items.length) return finishWarmup();
    const m = items[i];
    box.innerHTML = '';
    const card = h(`<div class="card stack">
      <div class="progress" style="margin:0"><i style="width:${(i / items.length) * 100}%"></i></div>
      <div class="small">${i + 1} of ${items.length} · ${esc(m.label)}</div>
      ${m.kind === 'word'
        ? `<div style="font-size:18px">How do you say this in English?</div><div class="ml" style="font-size:16px;color:var(--ink-2)">${esc(m.explanationMl)}</div>`
        : `<div style="font-size:18px">Say this the <b>right</b> way:</div><div style="font-size:19px;color:var(--warn)">“${esc(m.wrong)}”</div>`}
      <div data-answer style="display:none"><div class="right" style="font-size:19px;font-weight:700">✅ ${esc(m.corrected)}</div>${m.kind !== 'word' ? `<div class="why ml" style="color:var(--ink-2);margin-top:6px">${esc(m.explanationMl)}</div>` : ''}</div>
      <div class="row" style="justify-content:center;gap:18px">
        <button class="btn ghost" data-peek style="flex:0">👀 Show answer</button>
        <button class="mic retry" aria-label="Say it">${MIC_SVG}<span class="ring"></span></button>
        <button class="btn ghost" data-skip style="flex:0">Skip →</button>
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
            res.innerHTML = `<div class="retry-result ok">🎉 Perfect!</div>`;
            celebrate(r.mastery?.justMastered ? 'Mistake mastered!' : 'Perfect!');
            await sleep(1300);
            i++;
            return next();
          }
          answer.style.display = '';
          res.innerHTML = `<div class="retry-result no">Almost! Listen to the right sentence and try again 💪<span class="heard">We heard: “${esc(r.transcript)}”</span></div>`;
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
      h(`<div class="empty"><div class="e">💪</div><h2>Warm-up done!</h2><p>You said ${passed} of ${items.length} sentences the right way.</p>
        <div class="stack"><a class="btn block" href="#/">Now have a conversation →</a><a class="btn block secondary" href="#/bank">Open Mistake Bank</a></div></div>`),
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
      <h1>Save your progress</h1>
      <p class="lead">We'll send a 6-digit code to your WhatsApp / phone. No password needed.</p>
      <label class="lbl" for="ph">Mobile number</label>
      <div class="field"><span class="pre">+91</span><input id="ph" type="tel" inputmode="tel" autocomplete="tel" placeholder="98765 43210" required /></div>
      <div class="err"></div>
      <button class="btn block whatsapp" style="margin-top:6px">Send code</button>
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
      <div class="field otp"><input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required /></div>
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
          toast('Welcome back! 👋');
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
    const u = state.me.user;
    const f = profileForm(u, 'Tell your partner a little about you', "So every conversation feels like catching up with a coach who knows you. (Optional)", 'Save & continue');
    f.addEventListener('saved', () => {
      toast('Saved! 🎉 Your free sessions are unlocked.');
      after();
    });
    const skip = h(`<button type="button" class="btn ghost block">Skip</button>`);
    skip.addEventListener('click', after);
    f.append(skip);
    box.append(f);
  };

  if (!state.me.user.isGuest) stepProfile();
  else stepPhone();
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

// ─── Profile ─────────────────────────────────────────────────
async function renderProfile() {
  await loadMe();
  if (state.me.user.isGuest) return go('#/login');
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  const f = profileForm(state.me.user, 'Your profile', `Logged in as ${state.me.user.phone}`, 'Save');
  f.addEventListener('saved', () => toast('Saved ✓'));
  $app.append(f);
  const a = state.me.allowance;
  $app.append(
    h(`<div class="card" style="margin-top:20px"><b>Your plan</b><p class="small" style="margin:4px 0 0">${
      a.plan === 'paid' ? 'Monthly pass — active ✓' : a.canStart ? `Free trial · ${a.remaining} session${a.remaining === 1 ? '' : 's'} left` : 'Free trial finished'
    }</p></div>`),
  );
  const out = h(`<button class="btn ghost block" style="margin-top:16px">Log out</button>`);
  out.addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    state.me = null;
    go('#/');
  });
  $app.append(out);
}

// ─── Upgrade / limits ────────────────────────────────────────
async function renderUpgrade() {
  await loadMe();
  const a = state.me.allowance;
  $app.innerHTML = '';
  $app.append(topbar({ back: true }));
  track('paywall_shown', { reason: a.reason });
  if (a.reason === 'daily_limit') {
    $app.append(
      h(`<div class="empty"><div class="e">🌙</div><h2>That's enough for today!</h2><p>You've done your practice for today — great work. Your brain learns while you rest. Come back tomorrow to keep your 🔥 streak.</p><a class="btn" href="#/bank">Review your Mistake Bank</a></div>`),
    );
    return;
  }
  const s = state.me.stats;
  const card = h(`<section>
    <h1>Keep the habit going 💪</h1>
    <p class="lead">You've used your free sessions. In that time you spoke for <b>${s.minutesSpoken} minutes</b> and fixed <b>${s.mistakesMastered}</b> old mistakes.</p>
    <div class="card stack">
      <div style="font-size:22px;font-weight:800">Monthly pass · ${esc(state.me.upgrade.price)}</div>
      <div>✅ Daily speaking practice<br/>✅ Your personal Mistake Bank & warm-ups<br/>✅ A partner who remembers you</div>
      <a class="btn block accent" data-up href="${esc(state.me.upgrade.url || '#/')}" target="_blank" rel="noopener">Get the monthly pass</a>
    </div>
    <p class="small center" style="margin-top:14px">Less than a cup of coffee a week ☕</p>
  </section>`);
  card.querySelector('[data-up]').addEventListener('click', () => track('upgrade_clicked'));
  $app.append(card);
}

router();

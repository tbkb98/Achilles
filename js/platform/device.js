// Phone features, each one optional: the app must work when any of them is missing.
let ctx = null, lock = null, wantLock = false, hapticLabel = null;

// --- sound: an 8-bit bell made with oscillators, no audio files ---
export function unlockAudio(loud) {
  try {
    if (loud && navigator.audioSession) navigator.audioSession.type = 'playback'; // sound through the silent switch (iOS 17+)
    else if (navigator.audioSession) navigator.audioSession.type = 'auto';
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* no sound on this device */ }
}
// Ring bell, synthesised the way a struck bell actually sounds: a set of inharmonic sine partials,
// each fading at its own rate (high ones die first), every partial doubled a hair apart so the
// tone shimmers, plus a few milliseconds of filtered noise for the hammer hitting metal.
const PARTIALS = [ // [ratio to the strike note, level, seconds to fade]
  [0.5, 0.18, 2.6], [0.92, 0.3, 2.2], [1.0, 1.0, 2.0], [1.19, 0.36, 1.5], [1.56, 0.3, 1.2], [2.0, 0.6, 1.1],
  [2.51, 0.3, 0.8], [2.74, 0.32, 0.7], [3.0, 0.2, 0.6], [3.76, 0.18, 0.45], [4.07, 0.14, 0.35], [5.4, 0.08, 0.25],
];
export const BELL_TONES = { deep: 660, ring: 990, sharp: 1480 };
function strike(at, f0, vol, sustain) {
  const t = ctx.currentTime + at, out = ctx.createGain();
  out.gain.value = vol; out.connect(ctx.destination);   // no compressor: it squashed the first strike
  for (const [ratio, level, fade] of PARTIALS) for (const twin of [1, 1.0035]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), d = Math.max(0.08, fade * sustain);
    o.type = 'sine'; o.frequency.value = f0 * ratio * twin;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level * 0.5, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
  }
  const len = Math.floor(ctx.sampleRate * 0.025), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
  for (let k = 0; k < len; k++) ch[k] = (Math.random() * 2 - 1) * (1 - k / len);
  const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
  bp.type = 'bandpass'; bp.frequency.value = f0 * 3.2; bp.Q.value = 0.7; ng.gain.value = 0.9;
  n.buffer = buf; n.connect(bp).connect(ng).connect(out); n.start(t);
}
// End of round: ding-ding-ding. The first two are cut short by the next blow; the last rings out.
export function bell(tone) {
  try {
    if (!ctx) return;
    const f0 = BELL_TONES[tone] || BELL_TONES.ring;
    strike(0, f0, 0.26, 0.22); strike(0.27, f0, 0.26, 0.22); strike(0.54, f0, 0.28, 1.25);
  } catch (e) {}
}
export function tick() { try { if (ctx) strike(0, 1320, 0.05, 0.08); } catch (e) {} }

// --- keep the screen awake during a session (iOS 18.4+ in Home Screen apps) ---
async function acquire() {
  try { if (wantLock && !lock && navigator.wakeLock && document.visibilityState === 'visible') { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch (e) { lock = null; }
}
export function keepAwake(on) { wantLock = on; if (on) acquire(); else if (lock) { lock.release().catch(() => {}); lock = null; } }
document.addEventListener('visibilitychange', acquire);

// --- haptic tick, through Safari's switch control ---
// Works on iOS 17.4 to 26.4. Apple closed this route in iOS 26.5, so on newer systems the call does nothing;
// a web app has no other way to reach the Taptic Engine. Kept because it is harmless and still ticks on older phones.
export function haptic() {
  try {
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.cssText = 'position:fixed;left:-100px;top:0;opacity:0;pointer-events:none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
      hapticLabel.append(i); document.body.append(hapticLabel);
    }
    hapticLabel.click();
  } catch (e) {}
}

export function flash() {
  const f = document.createElement('div'); f.className = 'flash'; document.body.append(f);
  setTimeout(() => f.remove(), 650);
}

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

export async function shareFile(name, text, type) {
  const file = new File([text], name, { type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}

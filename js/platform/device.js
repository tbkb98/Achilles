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
function note(freq, at, dur, vol = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + at);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + dur + 0.02);
}
// One strike of a ring bell in square waves: a fundamental, a slightly detuned twin for the
// metallic shimmer, and two short inharmonic overtones for the clang.
function strike(at, ring, vol) {
  note(1047, at, ring, vol); note(1061, at, ring, vol * 0.55);
  note(2794, at, ring * 0.5, vol * 0.3); note(4435, at, ring * 0.2, vol * 0.18);
}
// Boxing bell: ding-ding-ding, the last one left to ring.
export function bell() { try { strike(0, 0.3, 0.1); strike(0.2, 0.3, 0.1); strike(0.4, 1.3, 0.11); } catch (e) {} }
export function tick() { try { note(660, 0, 0.08, 0.08); } catch (e) {} }

// --- keep the screen awake during a session (iOS 18.4+ in Home Screen apps) ---
async function acquire() {
  try { if (wantLock && !lock && navigator.wakeLock && document.visibilityState === 'visible') { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch (e) { lock = null; }
}
export function keepAwake(on) { wantLock = on; if (on) acquire(); else if (lock) { lock.release().catch(() => {}); lock = null; } }
document.addEventListener('visibilitychange', acquire);

// --- haptic tick: only fires inside a tap, through Safari's switch control ---
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

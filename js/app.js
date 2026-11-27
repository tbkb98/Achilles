// Boot, router, shared UI pieces.
import { S, load, activeSession, settings } from './state.js';
import { h } from './dom.js';
import { keepAwake, isIOS, isStandalone, unlockAudio } from './platform/device.js';
import { todayView } from './ui/today.js';
import { sessionView } from './ui/session.js';
import { historyView, logView } from './ui/history.js';
import { settingsView } from './ui/settings.js';
import { eatView } from './ui/eat.js';
import { spaView } from './ui/recovery.js';
import { progressView } from './ui/progress.js';
import { pillarsView } from './ui/pillars.js';
import { routinesView } from './ui/routines.js';

export const VERSION = '1.2.0';

// One ticker at a time: the visible screen registers what must update four times a second.
let ticker = null;
export const setTicker = (fn) => { ticker = fn; };
const runTicker = () => { if (ticker && document.visibilityState === 'visible') { try { ticker(); } catch (e) { console.error(e); } } };
setInterval(runTicker, 250);
document.addEventListener('visibilitychange', runTicker);

export function go(route) { if (location.hash === '#' + route) render(); else location.hash = route; }
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

export function toast(msg) {
  document.querySelectorAll('.toast').forEach((n) => n.remove());
  const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
export function sheet(build) {
  const back = h('div', { class: 'sheet-back', onclick: (e) => { if (e.target === back) close(); } });
  const close = () => back.remove();
  back.append(h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, build(close)));
  document.body.append(back);
  return close;
}

function svg(d) { const t = document.createElement('template'); t.innerHTML = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${d}</svg>`; return t.content.firstChild; }
const TABS = [
  ['today', 'Today', '<path d="M3 11l9-8 9 8v9H3z"/>'],
  ['train', 'History', '<path d="M2 12h20M6 7v10M18 7v10"/>'],
  ['eat', 'Eat', '<path d="M3 11h18a9 9 0 0 1-18 0zM12 3v5"/>'],
  ['progress', 'Progress', '<path d="M3 20h18M6 16v-4M11 16V8M16 16V5"/>'],
  ['settings', 'Settings', '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>'],
];
function tabbar(r) {
  const on = r === 'log' ? 'train' : r === 'pillars' || r === 'routines' ? 'settings' : r;
  return h('nav', { class: 'tabbar', 'aria-label': 'Tabs' }, TABS.map(([id, name, d]) => h('button', { class: id === on ? 'on' : '', 'aria-current': id === on ? 'page' : null, onclick: () => go(id) }, svg(d), name)));
}

function installView() {
  return h('div', { class: 'screen' },
    h('div', { class: 'push' }),
    h('img', { class: 'px', src: 'assets/sprites/icon-192.png', width: 96, height: 96, alt: '', style: 'border-radius:22px;margin:0 auto' }),
    h('div', { class: 'h1 gold center' }, 'ACHILLES'),
    h('div', { class: 'panel' },
      h('div', { class: 'label gold' }, 'Put it on your Home Screen'),
      h('div', {}, '1. Tap the Share button in Safari.'),
      h('div', {}, '2. Choose "Add to Home Screen".'),
      h('div', {}, '3. Open Achilles from the new icon.'),
      h('div', { class: 'mute small' }, 'From then on it runs without a connection and keeps your log on this phone.')),
    h('button', { class: 'btn', onclick: () => { sessionStorage.setItem('skipInstall', '1'); render(); } }, 'Continue in the browser'),
    h('div', { class: 'push' }));
}

export function render() {
  if (!S.ready) return;
  ticker = null;
  document.querySelectorAll('.sheet-back').forEach((n) => n.remove());
  const root = document.getElementById('app');
  const [r, arg] = (location.hash.slice(1) || 'today').split('/');
  const a = activeSession();
  let view, tabbed = true;
  if (isIOS() && !isStandalone() && !sessionStorage.getItem('skipInstall')) { view = installView(); tabbed = false; }
  else if (r === 'session') {
    if (!a) { location.replace('#today'); return; }
    view = sessionView(a); tabbed = false;
  } else if (r === 'spa') { view = spaView(); tabbed = false; }
  else if (r === 'train') view = historyView();
  else if (r === 'eat') view = eatView();
  else if (r === 'progress') view = progressView();
  else if (r === 'pillars') view = pillarsView();
  else if (r === 'routines') view = routinesView();
  else if (r === 'log') view = logView(arg);
  else if (r === 'settings') view = settingsView();
  else view = todayView();
  keepAwake((r === 'session' && !!a && a.status === 'ACTIVE') || (r === 'spa' && !!S.kv.spaTimer));
  root.replaceChildren(view);
  if (tabbed) {
    if (a && r !== 'today') root.append(h('div', { class: 'minibar' }, h('button', { class: 'btn line-gold', style: 'background:var(--night)', onclick: () => go('session') }, a.status === 'ACTIVE' ? 'SESSION RUNNING · RETURN' : 'SESSION SUMMARY · RETURN')));
    root.append(tabbar(r));
  }
}

// Service worker: offline shell. A new version waits until T asks for it; never reload mid-session.
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    S.swReg = reg;
    const check = () => { if (reg.waiting && navigator.serviceWorker.controller && !S.updateReady) { S.updateReady = true; if (!activeSession()) render(); } };
    check();
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', check); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (S.wantReload) location.reload(); });
}
export function applyUpdate() { S.wantReload = true; if (S.swReg && S.swReg.waiting) S.swReg.waiting.postMessage('skip'); }

// iOS only lets sound start from inside a tap, so every tap during a session re-arms it.
for (const ev of ['touchend', 'click']) document.addEventListener(ev, () => { if (activeSession()) unlockAudio(settings().loud); }, { passive: true, capture: true });

(async function boot() {
  try { await load(); } catch (e) {
    document.getElementById('app').replaceChildren(h('div', { class: 'screen' }, h('div', { class: 'panel' }, h('div', { class: 'label gold' }, 'Storage is not available'), h('div', {}, 'Achilles could not open its database on this device. Private browsing blocks it; open the app from the Home Screen icon.'))));
    return;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((ok) => { S.persisted = ok; }).catch(() => {});
  registerSW();
  const a = activeSession();
  if (a && a.status === 'ACTIVE' && !location.hash) history.replaceState(null, '', '#session');
  render();
})();

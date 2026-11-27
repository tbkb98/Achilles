// Recovery: sauna and hammam minutes (edited to what was really done), an optional timer that
// records actual time, and stretching check-offs (SPA-01..04).
import { h, stepper, ok, clock } from '../dom.js';
import { S, settings, saveRecovery, deleteRecovery, setKV, activeSession } from '../state.js';
import { bell, flash, haptic, unlockAudio } from '../platform/device.js';
import { MORNING, EVENING } from '../../seed/mobility.js';
import { mobilitySheet, dailyFour } from './mobility.js';
import { render, go, setTicker } from '../app.js';

const editing = new Set();
const of = (date, type) => S.recovery.filter((r) => r.date === date && r.type === type);
const mins = (rs) => rs.reduce((n, r) => n + (r.durationMin || 0), 0);
const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
export const heatMinutes = (date) => mins(of(date, 'SAUNA')) + mins(of(date, 'HAMMAM'));

export async function writeHeat(date, sauna, hammam, sessionId) {
  for (const [type, m] of [['SAUNA', sauna], ['HAMMAM', hammam]]) {
    for (const r of of(date, type)) await deleteRecovery(r.id);
    if (m > 0) await saveRecovery({ id: `heat-${date}-${type}`, date, type, durationMin: m, sessionId: sessionId || null, loggedAt: new Date().toISOString() });
  }
}

// Shared by Today and the session summary. Returns the card's children.
export function spaCard(date, sessionId) {
  const st = settings(), sa = of(date, 'SAUNA'), ha = of(date, 'HAMMAM'), logged = sa.length + ha.length > 0;
  if (logged && !editing.has(date)) return [
    h('div', { class: 'gold' }, ok(), `Sauna ${mins(sa)} min · Hammam ${mins(ha)} min`),
    h('button', { class: 'btn', onclick: () => { editing.add(date); render(); } }, 'Change the minutes'),
  ];
  const v = { sauna: logged ? mins(sa) : st.sauna, hammam: logged ? mins(ha) : st.hammam };
  const row = (label, key) => h('div', { class: 'stepper sm' }, h('span', { style: 'width:80px' }, label),
    stepper({ value: v[key], step: 1, max: 90, fmt: (x) => `${x} min`, label: `${label} minutes`, onChange: (x) => { v[key] = x; } }));
  return [
    row('Sauna', 'sauna'), row('Hammam', 'hammam'),
    h('button', { class: 'btn ox', onclick: async () => { haptic(); await writeHeat(date, v.sauna, v.hammam, sessionId); editing.delete(date); render(); } }, ok(), logged ? 'SAVE' : 'LOG THESE MINUTES'),
    !logged && h('button', { class: 'btn', onclick: () => startSpa(date, sessionId, v) }, 'Or run a timer'),
    logged && h('button', { class: 'btn', onclick: () => { editing.delete(date); render(); } }, 'Cancel'),
  ];
}

function startSpa(date, sessionId, v) {
  if (v.sauna + v.hammam <= 0) return;
  unlockAudio(settings().loud);
  setKV('spaTimer', { date, sessionId: sessionId || null, phase: v.sauna > 0 ? 0 : 1, target: [v.sauna, v.hammam], rec: [0, 0], startedAt: Date.now(), belled: false });
  go('spa');
}
const back = () => go(activeSession() ? 'session' : 'today');

// Timer screen. The bell rings at the target, then the clock keeps counting: what gets logged is the real time.
export function spaView() {
  const t = S.kv.spaTimer;
  if (!t) { setTimeout(back); return h('div', { class: 'screen black' }); }
  const st = settings(), name = t.phase === 0 ? 'SAUNA' : 'HAMMAM', target = t.target[t.phase] * 60, more = t.phase === 0 && t.target[1] > 0;
  const time = h('div', { class: 'time gold', role: 'timer' }), sub = h('div', { class: 'label center' });
  const paint = () => {
    const rem = target - (Date.now() - t.startedAt) / 1000;
    time.textContent = rem > 0 ? clock(rem) : '+' + mmss(-rem);
    sub.textContent = rem > 0 ? `OF ${t.target[t.phase]} MIN` : 'OVER TIME · STILL COUNTING';
    return rem;
  };
  paint();
  setTicker(() => { if (paint() <= 0 && !t.belled) { t.belled = true; setKV('spaTimer', t); if (st.bell) bell(st.bellTone); if (st.flash) flash(); } });
  const actual = () => Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
  const finish = async () => { await writeHeat(t.date, t.rec[0], t.rec[1], t.sessionId); await setKV('spaTimer', null); back(); };
  const next = () => {
    haptic(); t.rec[t.phase] = actual();
    if (more) { t.phase = 1; t.startedAt = Date.now(); t.belled = false; setKV('spaTimer', t); render(); } else finish();
  };
  return h('div', { class: 'screen black' },
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'RECOVERY'), h('span', { class: 'label' }, more ? '1 OF 2' : 'LAST ONE')),
    h('div', { class: 'big gold center', style: 'font-size:30px;margin-top:20px' }, name), time, sub,
    h('div', { class: 'panel' }, 'Leave the phone outside the cabin, screen up. The bell rings when the time is up and the clock keeps counting, so the log shows what you really did.'),
    h('div', { class: 'push stack' },
      h('button', { class: 'btn gold xl', onclick: next }, more ? 'SAUNA DONE · START HAMMAM' : `${name} DONE · LOG`),
      h('div', { class: 'grid2' },
        more ? h('button', { class: 'btn', onclick: () => { t.rec[0] = actual(); t.rec[1] = 0; finish(); } }, 'Skip the hammam') : h('span', {}),
        h('button', { class: 'btn', onclick: async () => { await setKV('spaTimer', null); back(); } }, 'Cancel, log nothing'))));
}

// Morning and evening mobility: the list opens, one button marks it done (SPA-04).
export function recoveryExtras(date) {
  const tog = (label, type) => {
    const on = of(date, type).length > 0;
    const am = type === 'STRETCH_AM';
    return h('button', { class: 'btn tight' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: () => mobilitySheet({
      title: am ? 'Morning mobility' : 'Evening mobility', sub: am ? 'Five minutes. Energy and posture.' : 'Ten minutes. Recovery and flexibility.',
      groups: [{ items: am ? MORNING : EVENING }], foot: dailyFour(), done: on, doneLabel: am ? 'MORNING DONE' : 'EVENING DONE',
      onDone: async () => { await saveRecovery({ id: `rec-${date}-${type}`, date, type, loggedAt: new Date().toISOString() }); render(); },
      onUndo: async () => { for (const r of of(date, type)) await deleteRecovery(r.id); render(); } }) }, on && ok(), label);
  };
  return h('div', { class: 'grid2' }, tog('Stretch AM', 'STRETCH_AM'), tog('Stretch PM', 'STRETCH_PM'));
}

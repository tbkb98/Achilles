// Session history: list, detail, and fixing mistakes after the fact (SES-18).
import { h, kg, niceDate, stepper } from '../dom.js';
import { S, saveSession, deleteSession } from '../state.js';
import { RULE, setsLogged } from '../engine/progression.js';
import { go, render, sheet } from '../app.js';
import { nameWithVariant } from './common.js';

let showOld = false;
const TYPE = { UPPER: 'upper', LOWER: 'lower', FULL: 'full body' };
const sorted = () => S.sessions.filter((s) => s.status === 'COMPLETED').sort((a, b) => (a.date === b.date ? (b.startedAt || 0) - (a.startedAt || 0) : a.date < b.date ? 1 : -1));

export function historyView() {
  const all = sorted(), old = all.filter((s) => s.dayType === 'FULL'), list = showOld ? all : all.filter((s) => s.dayType !== 'FULL');
  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'row' }, h('div', { class: 'label' }, 'HISTORY'), h('div', { class: 'label' }, `${all.length} SESSIONS`)),
    !all.length && h('div', { class: 'panel' }, 'No sessions yet. Your first one lands here the moment you finish it.'),
    list.map((s) => h('button', { class: 'list-btn', onclick: () => go('log/' + s.id) },
      h('span', {}, niceDate(s.date) + (s.date.slice(0, 4) !== String(new Date().getFullYear()) ? ` ${s.date.slice(0, 4)}` : ''), h('span', { class: 'mute' }, ` · ${TYPE[s.dayType] || ''}`)),
      h('span', { class: 'mute small', style: 'white-space:nowrap' }, `${setsLogged(s)} sets${s.imported ? ' · from your sheet' : ''}`))),
    old.length > 0 && h('button', { class: 'btn', onclick: () => { showOld = !showOld; render(); } }, showOld ? 'Hide the older sheet' : `Show ${old.length} sessions from your 2024–25 sheet`));
}

function setsText(e) {
  if (!e.logged.length) return '';
  const reps = e.logged.map((l) => l.reps).join(', '), l = e.logged[0];
  const hold = e.logged.filter((x) => x.holdSec).map((x) => `${x.holdSec} s`).join(', ');
  if (e.rule === RULE.UNW) return `${reps} reps`;
  if (e.rule === RULE.BW) return `${l.ext ? 'BW + ' + kg(l.ext) + ' kg' : 'BW'} × ${reps}`;
  return `${kg(l.load)} kg × ${reps}` + (hold ? ` · holds ${hold}` : '');
}

function editSets(s, e) {
  sheet((close) => {
    const draft = e.logged.map((l) => ({ ...l }));
    const weighted = e.rule !== RULE.UNW && e.rule !== RULE.BW;
    const box = h('div', { class: 'stack' });
    const draw = () => box.replaceChildren(...draft.map((l, i) => h('div', { class: 'panel', style: 'padding:10px;gap:8px' },
      h('div', { class: 'label' }, `SET ${i + 1}`),
      weighted && h('div', { class: 'stepper sm' }, stepper({ value: l.load ?? 0, step: e.inc || 2.5, fmt: (x) => `${kg(x)} kg`, label: `set ${i + 1} weight`, onChange: (x) => { l.load = x; } })),
      e.rule === RULE.BW && h('div', { class: 'stepper sm' }, stepper({ value: l.ext || 0, step: e.inc || 2.5, fmt: (x) => (x ? `BW + ${kg(x)} kg` : 'bodyweight'), label: `set ${i + 1} added weight`, onChange: (x) => { l.ext = x; } })),
      h('div', { class: 'stepper sm' }, stepper({ value: l.reps, step: 1, fmt: (x) => `${x} reps`, label: `set ${i + 1} reps`, onChange: (x) => { l.reps = x; } })))));
    draw();
    return [
      h('div', { class: 'label gold' }, e.name), box,
      h('div', { class: 'grid2' },
        h('button', { class: 'btn', onclick: () => { const l = draft[draft.length - 1]; draft.push(l ? { ...l, holdSec: null } : { reps: e.reps || 10, load: weighted ? 0 : null, ext: 0, at: 0 }); draw(); } }, 'Add a set'),
        h('button', { class: 'btn', onclick: () => { draft.pop(); draw(); } }, 'Remove last')),
      h('button', { class: 'btn on', onclick: async () => { e.logged = draft; s.edited = true; await saveSession(s); close(); render(); } }, 'Save'),
      h('button', { class: 'btn line-gold', onclick: close }, 'CANCEL'),
    ];
  });
}

export function logView(id) {
  const s = S.sessions.find((x) => x.id === id);
  if (!s) return historyView();
  const mins = s.endedAt && s.startedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : null;
  let armed = false;
  const del = h('button', { class: 'btn', onclick: async () => {
    if (!armed) { armed = true; del.textContent = 'Tap again to delete this session'; del.classList.add('on'); return; }
    await deleteSession(s.id); go('train');
  } }, 'Delete this session');
  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'row' }, h('button', { class: 'link label', onclick: () => go('train') }, '‹ HISTORY'), h('div', { class: 'label' }, s.imported ? 'FROM YOUR SHEET' : mins ? `${mins} MIN` : '')),
    h('div', { class: 'h1 gold' }, `${niceDate(s.date)} ${s.date.slice(0, 4)} · ${(TYPE[s.dayType] || '').toUpperCase()}`),
    s.exercises.filter((e) => e.logged.length || !e.skipped).map((e) => h('button', { class: 'list-btn', 'aria-label': `Edit ${e.name}`, onclick: () => editSets(s, e) },
      h('span', { class: 'stack', style: 'gap:2px' }, h('span', {}, nameWithVariant(e)), h('span', { class: 'mute small' }, (setsText(e) || 'not done') + (e.note ? ` · ${e.note}` : ''))),
      h('span', { class: 'mute small' }, 'Edit'))),
    s.notes && h('div', { class: 'panel' }, h('div', { class: 'label' }, 'NOTE'), h('div', {}, s.notes)),
    del);
}

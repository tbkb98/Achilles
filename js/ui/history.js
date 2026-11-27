// Session history: list and read-only detail. Editing arrives in milestone 2.
import { h, kg, niceDate } from '../dom.js';
import { S } from '../state.js';
import { RULE, setsLogged } from '../engine/progression.js';
import { go } from '../app.js';
import { nameWithVariant } from './common.js';

const sorted = () => S.sessions.filter((s) => s.status === 'COMPLETED').sort((a, b) => (a.date === b.date ? (b.startedAt || 0) - (a.startedAt || 0) : a.date < b.date ? 1 : -1));

export function historyView() {
  const list = sorted();
  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'row' }, h('div', { class: 'label' }, 'HISTORY'), h('div', { class: 'label' }, `${list.length} SESSIONS`)),
    !list.length && h('div', { class: 'panel' }, 'No sessions yet. Your first one lands here the moment you finish it.'),
    list.map((s) => h('button', { class: 'list-btn', onclick: () => go('log/' + s.id) },
      h('span', {}, niceDate(s.date), h('span', { class: 'mute' }, ` · ${s.dayType.toLowerCase()}`)),
      h('span', { class: 'mute small', style: 'white-space:nowrap' }, `${setsLogged(s)} sets${s.imported ? ' · from your sheet' : ''}`))));
}

function setsText(e) {
  const reps = e.logged.map((l) => l.reps).join(', '), l = e.logged[0];
  const hold = e.logged.filter((x) => x.holdSec).map((x) => `${x.holdSec} s`).join(', ');
  if (e.rule === RULE.UNW) return `${reps} reps`;
  if (e.rule === RULE.BW) return `${l.ext ? 'BW + ' + kg(l.ext) + ' kg' : 'BW'} × ${reps}`;
  return `${kg(l.load)} kg × ${reps}` + (hold ? ` · holds ${hold}` : '');
}

export function logView(id) {
  const s = S.sessions.find((x) => x.id === id);
  if (!s) return historyView();
  const mins = s.endedAt && s.startedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : null;
  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'row' }, h('button', { class: 'link label', onclick: () => go('train') }, '‹ HISTORY'), h('div', { class: 'label' }, s.imported ? 'FROM YOUR SHEET' : mins ? `${mins} MIN` : '')),
    h('div', { class: 'h1 gold' }, `${niceDate(s.date)} · ${s.dayType}`),
    h('div', { class: 'panel' }, s.exercises.filter((e) => e.logged.length).map((e) => h('div', { class: 'stack', style: 'gap:2px' },
      h('div', {}, nameWithVariant(e)), h('div', { class: 'mute small' }, setsText(e) + (e.note ? ` · ${e.note}` : ''))))),
    s.notes && h('div', { class: 'panel' }, h('div', { class: 'label' }, 'NOTE'), h('div', {}, s.notes)));
}

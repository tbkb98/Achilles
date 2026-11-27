// Warm-up, cool-down and daily mobility: plain lists that tick.
import { h, ok } from '../dom.js';
import { sheet } from '../app.js';
import { DAILY_FOUR } from '../../seed/mobility.js';

// items: [[what, how much]]. ticks: array of indexes, kept by the caller and changed in place.
export function checklist(items, ticks, onChange, offset = 0) {
  return items.map(([what, dose], k) => {
    const i = k + offset;
    const b = h('button', { class: 'check' + (ticks.includes(i) ? ' on' : ''), 'aria-pressed': ticks.includes(i) ? 'true' : 'false', onclick: () => {
      const at = ticks.indexOf(i); if (at >= 0) ticks.splice(at, 1); else ticks.push(i);
      b.classList.toggle('on', at < 0); b.setAttribute('aria-pressed', at < 0 ? 'true' : 'false');
      if (onChange) onChange(ticks);
    } }, h('span', { class: 'box' }, ok()), h('span', { class: 'what' }, h('span', {}, what), h('span', { class: 'mute small' }, dose)));
    return b;
  });
}

export const dailyFour = () => h('div', { class: 'mute small' }, `Every day, whatever else is skipped: ${DAILY_FOUR.join(', ').toLowerCase()}.`);

// A list in a sheet with one button that marks it done. groups: [{ label, items }]
export function mobilitySheet({ title, sub, groups, done, doneLabel, onDone, onUndo, foot }) {
  sheet((close) => {
    const ticks = []; let n = 0;
    const body = groups.flatMap((g) => { const rows = [g.label && h('div', { class: 'label' }, g.label), ...checklist(g.items, ticks, null, n)]; n += g.items.length; return rows; });
    return [
      h('div', { class: 'label gold' }, title), sub && h('div', { class: 'mute small' }, sub), ...body, foot,
      done ? h('button', { class: 'btn', onclick: async () => { await onUndo(); close(); } }, 'Not done after all')
        : h('button', { class: 'btn gold', onclick: async () => { await onDone(); close(); } }, ok(), doneLabel || 'DONE'),
      h('button', { class: 'btn line-gold', onclick: close }, 'CLOSE'),
    ];
  });
}

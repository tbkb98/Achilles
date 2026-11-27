// Pillars and quotes: what rotates under the rest timer. T's own additions stay on the phone.
import { h } from '../dom.js';
import { S, setKV } from '../state.js';
import { allPillars } from '../program.js';
import { POWER } from '../../seed/program.js';
import { go, render, toast } from '../app.js';

export function pillarsView() {
  const list = allPillars(), hidden = (S.kv.pillarState && S.kv.pillarState.hidden) || [];
  const text = h('textarea', { 'aria-label': 'The line', placeholder: 'A line that gets you under the bar' });
  const author = h('input', { class: 'inp', type: 'text', placeholder: 'Who said it (leave empty if it is yours)', 'aria-label': 'Who said it' });
  const source = h('input', { class: 'inp', type: 'text', placeholder: 'Where it is from: book, film, interview', 'aria-label': 'Where it is from' });
  const add = async () => {
    const t = text.value.trim(); if (!t) return;
    let a = author.value.trim(); const src = source.value.trim();
    if (a && !src) { a = ''; toast('Saved without a name. Add where it is from to keep the name on it.'); }
    await setKV('pillars', [...(S.kv.pillars || []), { id: 'p' + Date.now().toString(36), text: t, author: a, source: src }]);
    render();
  };
  const flip = async (p) => { await setKV('pillarState', { hidden: p.hidden ? hidden.filter((x) => x !== p.id) : [...hidden, p.id] }); render(); };
  const drop = async (p) => { await setKV('pillars', (S.kv.pillars || []).filter((x) => x.id !== p.id)); render(); };
  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'row' }, h('button', { class: 'link label', onclick: () => go('settings') }, '‹ SETTINGS'), h('div', { class: 'label' }, `${list.filter((p) => !p.hidden).length} IN ROTATION`)),
    h('div', { class: 'panel goldline' }, h('div', { class: 'label gold' }, 'Under the bar, from two minutes on'), h('div', { class: 'quote' }, POWER)),
    h('div', { class: 'panel' }, h('div', { class: 'label gold' }, 'Add your own'), text, author, source,
      h('div', { class: 'mute small' }, 'A name is kept only with a source, so nobody is quoted on something they never said.'),
      h('button', { class: 'btn on', onclick: add }, 'Add to the rotation')),
    list.map((p) => h('div', { class: 'panel', style: p.hidden ? 'opacity:.5' : '' },
      h('div', {}, p.text), p.author && h('div', { class: 'mute small' }, `— ${p.author}${p.source ? ', ' + p.source : ''}`),
      h('div', { class: 'grid2' },
        h('button', { class: 'btn tight', 'aria-pressed': p.hidden ? 'false' : 'true', onclick: () => flip(p) }, p.hidden ? 'Bring back' : 'Rest it'),
        p.seed ? h('span', {}) : h('button', { class: 'btn tight', onclick: () => drop(p) }, 'Delete')))));
}

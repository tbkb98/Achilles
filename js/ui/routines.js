// Routine editor (PRO-01): order, sets, reps, Fat Gripz, add and remove. Edits sit on top of the built-in routines.
import { h, stepper } from '../dom.js';
import { S, setKV } from '../state.js';
import { EXERCISES, TEMPLATES } from '../../seed/program.js';
import { templates, templateById } from '../program.js';
import { go, render, sheet } from '../app.js';

let pick = 'lower';
const LABEL = { lower: 'Lower', 'upper-revised': 'Upper revised', 'upper-logged': 'Upper as logged' };
const FG = 'Fat Gripz';

export function routinesView() {
  const t = templateById(pick), items = t.items.map((x) => ({ ...x }));
  const edited = !!(S.kv.templates && S.kv.templates[pick]);
  const store = (redraw) => setKV('templates', { ...(S.kv.templates || {}), [pick]: items }).then(() => { if (redraw) render(); });
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; store(true); };
  const reset = async () => { const all = { ...(S.kv.templates || {}) }; delete all[pick]; await setKV('templates', all); render(); };
  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'row' }, h('button', { class: 'link label', onclick: () => go('settings') }, '‹ SETTINGS'), h('div', { class: 'label' }, edited ? 'EDITED' : 'AS BUILT')),
    h('div', { class: 'grid3' }, TEMPLATES.map((x) => h('button', { class: 'btn tight' + (x.id === pick ? ' on' : ''), 'aria-pressed': x.id === pick ? 'true' : 'false', onclick: () => { pick = x.id; render(); } }, LABEL[x.id] || x.name))),
    h('div', { class: 'mute small' }, 'Changes apply from the next session you start. Loads follow each lift, so reordering loses nothing.'),
    items.map((it, i) => {
      const def = EXERCISES[it.ex], span = it.top ? it.top - it.reps : 0;
      return h('div', { class: 'panel', style: 'padding:10px;gap:8px' },
        h('div', { class: 'row' }, h('span', {}, `${i + 1}. ${def.name}`, it.optional ? h('span', { class: 'chip', style: 'margin-left:8px' }, 'OPTIONAL') : null), h('span', { class: 'row', style: 'gap:6px' },
          h('button', { class: 'btn tight', style: 'width:48px', 'aria-label': `Move ${def.name} up`, disabled: i === 0, onclick: () => move(i, -1) }, '▲'),
          h('button', { class: 'btn tight', style: 'width:48px', 'aria-label': `Move ${def.name} down`, disabled: i === items.length - 1, onclick: () => move(i, 1) }, '▼'))),
        it.protocol ? h('div', { class: 'mute small' }, 'Five-stage protocol with holds.') : h('div', { class: 'grid2' },
          h('div', { class: 'stepper xs' }, stepper({ value: it.sets, step: 1, min: 1, max: 8, fmt: (x) => `${x} set${x === 1 ? '' : 's'}`, label: `${def.name} sets`, onChange: (x) => { it.sets = x; store(false); } })),
          h('div', { class: 'stepper xs' }, stepper({ value: it.reps, step: 1, min: 1, max: 50, fmt: (x) => (it.top ? `${x}–${x + span} reps` : `${x} reps`), label: `${def.name} reps`, onChange: (x) => { it.reps = x; if (it.top) it.top = x + span; store(false); } }))),
        h('div', { class: 'grid2' },
          def.equip === 'barbell' && it.ex !== 'squat' ? h('button', { class: 'btn tight' + (it.variant === FG ? ' on' : ''), 'aria-pressed': it.variant === FG ? 'true' : 'false', onclick: () => { it.variant = it.variant === FG ? '' : FG; store(true); } }, it.variant === FG ? 'With Fat Gripz' : 'No Fat Gripz') : h('span', {}),
          h('button', { class: 'btn tight', 'aria-label': `Remove ${def.name}`, onclick: () => { items.splice(i, 1); store(true); } }, 'Remove')));
    }),
    h('button', { class: 'btn', onclick: () => sheet((close) => [
      h('div', { class: 'label gold' }, 'Add to this routine'),
      Object.entries(EXERCISES).filter(([id]) => !items.some((x) => x.ex === id) && id !== 'legext').map(([id, def]) => h('button', { class: 'btn', onclick: () => { const bw = def.equip === 'bodyweight' || def.equip === 'none'; items.push({ ex: id, sets: bw ? 2 : 3, reps: id === 'squat' ? 20 : bw ? 20 : 12 }); close(); store(true); } }, def.name)),
      h('button', { class: 'btn line-gold', onclick: close }, 'CLOSE')]) }, 'Add an exercise'),
    edited && h('button', { class: 'btn', onclick: reset }, 'Back to the routine as built'));
}

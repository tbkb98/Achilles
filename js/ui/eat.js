// Eat: the day's meal slots, one tap each; portions, quick entry, extras, milk (NUT-01..09).
import { h, stepper, ok, bar } from '../dom.js';
import { S, setKV, saveDay, today } from '../state.js';
import { dayTotals, addDays, calorieSuggestion } from '../engine/nutrition.js';
import { render, sheet } from '../app.js';
import { haptic } from '../platform/device.js';

let eatDate = null;
const n0 = (x) => Math.round(x).toLocaleString();
const MULTS = [[0.5, '½'], [0.75, '¾'], [1, '1'], [1.25, '1¼'], [1.5, '1½'], [2, '2']];
const MILK_GOAL = 2000;
const newId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function plan() {
  const p = S.kv.mealPlan;
  if (p && p.slots.some((s) => !s.id)) { p.slots.forEach((s) => { if (!s.id) s.id = newId(); }); setKV('mealPlan', p); }
  return p || null;
}
export const planKcal = (p) => p.slots.reduce((a, s) => a + (s.kcal || 0), 0) + (p.kcalOffset || 0);
export const dayDoc = (date) => S.days.find((d) => d.id === date) || { id: date, date, slots: [], extras: [], milkMl: 0 };
export const targetFor = (day, p) => day.kcalTarget ?? (p ? p.kcalTarget || planKcal(p) : 0);
function put(day, p) { if (p && day.kcalTarget == null) day.kcalTarget = p.kcalTarget || planKcal(p); return saveDay(day); }

// A changed plan becomes a new version, so older days keep the target they were logged against (NUT-09).
async function savePlan(p) {
  const before = p.kcalTarget, now = planKcal(p);
  if (before !== now) {
    await setKV('mealPlanHistory', [...(S.kv.mealPlanHistory || []), { until: today(), kcalTarget: before ?? null }]);
    p.kcalTarget = now; p.validFrom = today();
  }
  await setKV('mealPlan', p);
  const d = S.days.find((x) => x.id === today());
  if (d) { d.kcalTarget = now; await saveDay(d); }
}

function mealForm(init, onSave, saveLabel) {
  let k = init.kcal ?? 500, pr = init.protein || 0;
  const name = h('input', { class: 'inp', type: 'text', value: init.name || '', placeholder: 'Name', 'aria-label': 'Name' });
  const time = init.time !== undefined ? h('input', { class: 'inp', type: 'time', value: init.time || '', 'aria-label': 'Usual time' }) : null;
  return [name, time,
    h('div', { class: 'stepper sm' }, stepper({ value: k, step: 50, max: 5000, fmt: (x) => `${n0(x)} kcal`, label: 'calories', onChange: (x) => { k = x; } })),
    h('div', { class: 'stepper sm' }, stepper({ value: pr, step: 5, max: 400, fmt: (x) => (x ? `${x} g protein` : 'protein not set'), label: 'protein', onChange: (x) => { pr = x; } })),
    h('button', { class: 'btn on', onclick: () => onSave({ name: name.value.trim(), time: time ? time.value : undefined, kcal: k, protein: pr || null }) }, saveLabel)];
}

function adjust(slot, day, p) {
  sheet((close) => {
    const e = day.slots.find((x) => x.slotId === slot.id);
    const set = async (patch) => {
      day.slots = day.slots.filter((x) => x.slotId !== slot.id);
      if (patch) day.slots.push({ slotId: slot.id, name: slot.name, kcal: slot.kcal, protein: slot.protein ?? null, mult: 1, status: 'ADJUSTED', ...patch });
      await put(day, p); close(); render();
    };
    let armed = false;
    const remove = h('button', { class: 'btn', onclick: async () => {
      if (!armed) { armed = true; remove.textContent = 'Tap again to remove it from the plan'; remove.classList.add('on'); return; }
      p.slots = p.slots.filter((x) => x.id !== slot.id); await savePlan(p); close(); render();
    } }, 'Remove from the plan');
    return [
      h('div', { class: 'label gold' }, slot.name),
      h('div', { class: 'mute small' }, 'How much of it did you eat?'),
      h('div', { style: 'display:grid;grid-template-columns:repeat(6,1fr);gap:6px' }, MULTS.map(([m, l]) => h('button', { class: 'btn tight' + (e && e.status !== 'SKIPPED' && e.mult === m && e.kcal === slot.kcal ? ' on' : ''), onclick: () => set({ mult: m, status: m === 1 ? 'AS_PLANNED' : 'ADJUSTED' }) }, l))),
      h('div', { class: 'grid2' },
        h('button', { class: 'btn', onclick: () => set({ status: 'SKIPPED', kcal: 0, protein: null }) }, 'Skipped today'),
        h('button', { class: 'btn', onclick: () => set(null) }, 'Clear')),
      h('div', { class: 'label', style: 'margin-top:8px' }, 'Something different today'),
      mealForm({ name: slot.name, kcal: e && e.status !== 'SKIPPED' ? e.kcal : slot.kcal, protein: e ? e.protein : slot.protein }, (m) => set({ name: m.name || slot.name, kcal: m.kcal, protein: m.protein }), 'Log these numbers for today'),
      h('div', { class: 'label', style: 'margin-top:8px' }, 'Change the plan itself'),
      mealForm({ name: slot.name, time: slot.time || '', kcal: slot.kcal, protein: slot.protein }, async (m) => { Object.assign(slot, { name: m.name || slot.name, time: m.time, kcal: m.kcal, protein: m.protein }); await savePlan(p); close(); render(); }, 'Save to the plan'),
      remove,
      h('button', { class: 'btn line-gold', onclick: close }, 'CLOSE'),
    ];
  });
}

export function eatView() {
  const t = today();
  if (!eatDate || eatDate > t) eatDate = t;
  const date = eatDate, p = plan(), day = dayDoc(date), tot = dayTotals(day), target = targetFor(day, p);
  const entry = (id) => day.slots.find((x) => x.slotId === id);
  const toggle = async (slot) => {
    haptic();
    const e = entry(slot.id);
    if (e) day.slots = day.slots.filter((x) => x !== e);
    else day.slots.push({ slotId: slot.id, name: slot.name, kcal: slot.kcal, protein: slot.protein ?? null, mult: 1, status: 'AS_PLANNED' });
    await put(day, p); render();
  };
  const row = (slot) => {
    const e = entry(slot.id), skipped = e && e.status === 'SKIPPED', on = !!e && !skipped;
    return h('div', { class: 'meal' + (on ? ' on' : '') },
      h('button', { class: 'meal-main', 'aria-pressed': on ? 'true' : 'false', onclick: () => toggle(slot) },
        h('span', { class: 'box' }, on && ok('nomargin')),
        slot.time && h('span', { class: 'mute small', style: 'width:48px;flex:none' }, slot.time),
        h('span', { style: 'flex:1' }, on && e.name !== slot.name ? e.name : slot.name, skipped && h('span', { class: 'mute' }, ' · skipped'), on && e.mult !== 1 && h('span', { class: 'gold' }, ` · ×${e.mult}`)),
        h('span', { class: 'num', style: 'font-size:10px;flex:none' }, n0(on ? e.kcal * e.mult : skipped ? 0 : slot.kcal))),
      h('button', { class: 'meal-more', 'aria-label': `Adjust ${slot.name}`, onclick: () => adjust(slot, day, p) }, '···'));
  };
  const orphans = p ? day.slots.filter((x) => !p.slots.some((s) => s.id === x.slotId)) : day.slots;
  const extraRow = (x, label, drop) => h('div', { class: 'meal on' },
    h('div', { class: 'meal-main' }, h('span', { class: 'box' }, ok('nomargin')), h('span', { style: 'flex:1' }, label), h('span', { class: 'num', style: 'font-size:10px' }, n0(x.kcal * (x.mult || 1)))),
    h('button', { class: 'meal-more', 'aria-label': `Remove ${label}`, onclick: async () => { drop(); await put(day, p); render(); } }, '×'));
  const milk = day.milkMl || 0;
  const setMilk = async (d) => { day.milkMl = Math.max(0, milk + d); haptic(); await put(day, p); render(); };
  // trend-based suggestion (BOD-04): a card to accept or wave off, never an automatic change
  const sug = p && date === t ? calorieSuggestion(S.weights, t, p.validFrom) : null;
  const snoozed = S.kv.suggestSnooze && S.kv.suggestSnooze >= addDays(t, -7);
  const sugCard = sug && sug.kind === 'change' && !snoozed ? h('div', { class: 'panel goldline' },
    h('div', { class: 'label gold' }, 'From your weight trend'),
    h('div', {}, sug.delta > 0 ? `Two weeks under half a kilo a week. Eat ${sug.delta} kcal more a day?` : `Two weeks over a kilo a week. Ease off by ${-sug.delta} kcal a day?`),
    h('div', { class: 'grid2' },
      h('button', { class: 'btn on', onclick: async () => { p.kcalOffset = (p.kcalOffset || 0) + sug.delta; await savePlan(p); render(); } }, `Make it ${n0(planKcal(p) + sug.delta)}`),
      h('button', { class: 'btn', onclick: async () => { await setKV('suggestSnooze', t); render(); } }, 'Not now')))
    : sug && sug.kind === 'early' ? h('div', { class: 'mute small' }, 'New plan: the first two weeks of gain are mostly water and glycogen, so no advice yet.') : null;
  const dateLabel = date === t ? 'TODAY' : new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();

  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'row' },
      h('button', { class: 'link label', 'aria-label': 'Previous day', onclick: () => { eatDate = addDays(date, -1); render(); } }, '‹ DAY BEFORE'),
      h('span', { class: 'label gold' }, dateLabel),
      h('button', { class: 'link label', disabled: date >= t, style: date >= t ? 'opacity:.3' : '', onclick: () => { eatDate = addDays(date, 1); render(); } }, 'NEXT ›')),
    h('div', { class: 'stack', style: 'gap:10px' },
      h('div', { class: 'row top' }, h('div', { class: 'big gold' }, n0(tot.kcal)), h('div', { class: 'mute' }, target ? `of ${n0(target)} kcal · ${tot.eaten} of ${p ? p.slots.length : 0} meals` : 'kcal')),
      target > 0 && bar(tot.kcal / target * 100),
      h('div', { class: 'mute small' }, tot.protein ? `Protein ${tot.protein} g${tot.partial ? ' counted so far; some meals have no protein value yet' : ''}` : 'Protein is counted once a meal has a protein value. Add it from the ··· button.')),
    sugCard,
    !p && h('div', { class: 'panel goldline' }, h('div', { class: 'label gold' }, 'No meal plan yet'), h('div', {}, 'Your setup file brings in your plan. Or add meals one by one below.')),
    h('div', { class: 'stack', style: 'gap:6px' }, p && p.slots.map(row),
      orphans.map((x) => extraRow(x, x.name, () => { day.slots = day.slots.filter((y) => y !== x); })),
      (day.extras || []).map((x) => extraRow(x, x.name || 'Extra', () => { day.extras = day.extras.filter((y) => y !== x); }))),
    h('div', { class: 'grid2' },
      h('button', { class: 'btn tight', onclick: () => sheet((close) => [h('div', { class: 'label gold' }, 'Something else today'), mealForm({ kcal: 300 }, async (m) => { day.extras = [...(day.extras || []), { id: newId(), name: m.name || 'Extra', kcal: m.kcal, protein: m.protein }]; await put(day, p); close(); render(); }, 'Add it to today'), h('button', { class: 'btn line-gold', onclick: close }, 'CLOSE')]) }, '+ Something else'),
      h('button', { class: 'btn tight', onclick: () => sheet((close) => [h('div', { class: 'label gold' }, 'New meal in the plan'), mealForm({ time: '', kcal: 500 }, async (m) => { const q = p || { name: 'My plan', validFrom: t, slots: [] }; q.slots.push({ id: newId(), name: m.name || 'Meal', time: m.time, kcal: m.kcal, protein: m.protein }); q.slots.sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1); await savePlan(q); close(); render(); }, 'Add to the plan'), h('button', { class: 'btn line-gold', onclick: close }, 'CLOSE')]) }, '+ Meal to plan')),
    h('div', { class: 'panel' },
      h('div', { class: 'row' }, h('span', {}, `Milk ${(milk / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} of ${MILK_GOAL / 1000} L`), h('span', { class: 'mute small' }, milk >= MILK_GOAL ? 'done' : '')),
      bar(milk / MILK_GOAL * 100, 'thin'),
      h('div', { class: 'grid2' }, h('button', { class: 'btn', disabled: milk <= 0, onclick: () => setMilk(-250) }, '− 250 ml'), h('button', { class: 'btn on', onclick: () => setMilk(250) }, '+ 250 ml'))));
}

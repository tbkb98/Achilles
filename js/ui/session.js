// The live workout: set card, rest timer, breathing squat mode, protocol runner, summary.
import { h, kg, clock, stepper, bar, ok } from '../dom.js';
import { S, settings, saveSession, deleteSession, closeSession } from '../state.js';
import { cur, logSet, undo, skip, doLater, endNow, adjustTimer, pendingFor, isSquat, addExercise } from '../engine/session.js';
import { setsPlanned, setsLogged, buildSession, RULE } from '../engine/progression.js';
import { plates } from '../engine/plates.js';
import { EXERCISES, PROTOCOLS, POWER, SQUAT_CUES } from '../../seed/program.js';
import { templateById, visiblePillars } from '../program.js';
import { bell, tick, flash, haptic } from '../platform/device.js';
import { render, setTicker, go, sheet } from '../app.js';
import { hero, heroSrc, stage, lastText, shortVal, targetText, scheme, nameWithVariant } from './common.js';
import { spaCard } from './recovery.js';

let saveT = null;
const commit = (s) => { clearTimeout(saveT); saveSession(s); render(); };
const saveSoon = (s) => { clearTimeout(saveT); saveT = setTimeout(() => saveSession(s), 300); };
const doLog = (s, v) => { haptic(); logSet(s, v, Date.now()); s.restOver = null; commit(s); };
const doUndo = (s) => { if (undo(s)) { s.restOver = null; commit(s); } };
const up = (e) => e.name.toUpperCase();
const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
const weighted = (e) => e.rule === RULE.DOUBLE || e.rule === RULE.SQUAT || e.rule === RULE.PROTO;

export function sessionView(s) {
  if (s.status === 'COMPLETED') return summary(s);
  if (s.timer && s.timer.endsAt <= Date.now()) { s.restOver = s.timer.endsAt; s.timer = null; saveSession(s); } // ended while away
  const e = cur(s);
  if (s.timer) return restView(s, e);
  if (isSquat(e)) return squatView(s, e);
  if (e.stages) return protocolView(s, e);
  return setView(s, e);
}

function header(s, mid) {
  const mins = Math.floor((Date.now() - s.startedAt) / 60000);
  const live = s.exercises.filter((x) => !x.skipped).length;
  const idx = s.exercises.slice(0, s.cursor + 1).filter((x) => !x.skipped).length;
  return h('div', { class: 'row' },
    h('button', { class: 'link label', style: 'white-space:nowrap', onclick: () => go('today') }, `‹ ${s.dayType} · ${mins} MIN`),
    h('span', { class: 'label', style: 'white-space:nowrap' }, mid || `LIFT ${idx} / ${live}`),
    h('button', { class: 'link label gold', onclick: () => menu(s) }, 'MENU'));
}

function pumpRow(s) {
  const done = setsLogged(s), all = Math.max(1, setsPlanned(s));
  return h('div', { class: 'row' }, hero(stage() + (done >= all ? 1 : 0), 64, 'hero-box'),
    h('div', { class: 'stack', style: 'flex:1;gap:8px' },
      h('div', { class: 'row' }, h('span', { class: 'label gold' }, 'PUMP'), h('span', { class: 'label' }, `${done} OF ${all} SETS`)),
      bar(done / all * 100)));
}

function fillPlates(box, load) {
  const st = settings(), p = plates(load, st.bar, st.plates);
  box.replaceChildren();
  if (!p) { box.append(h('span', { class: 'mute' }, `Lighter than the ${kg(st.bar)} kg bar`)); return; }
  box.append(h('span', { class: 'mute' }, p.plates.length ? 'Per side' : 'Empty bar'), ...p.plates.map((x) => h('span', { class: 'plate' }, kg(x))));
  if (p.leftover > 0) box.append(h('span', { class: 'mute small' }, `${kg(p.leftover * 2)} kg short with your plates`));
}
const hasPlates = (e) => !!(EXERCISES[e.ex] && EXERCISES[e.ex].plates);

function describe(e, v) {
  if (e.stages) return `${kg(v.load)} kg · ${v.reps} reps`;
  if (e.rule === RULE.UNW) return `${v.reps} reps`;
  if (e.rule === RULE.BW) return `${v.ext ? 'BW + ' + kg(v.ext) + ' kg' : 'bodyweight'} × ${v.reps}`;
  return v.load == null ? `set your load × ${v.reps}` : `${kg(v.load)} kg × ${v.reps}`;
}
function nextInfo(s) {
  const e = cur(s);
  if (e.logged.length + 1 < e.sets) return `${e.stages ? 'Stage' : 'Set'} ${e.logged.length + 2} of ${e.sets}`;
  const open = (x) => !x.skipped && x.logged.length < x.sets;
  const nx = s.exercises.slice(s.cursor + 1).find(open) || s.exercises.find((x, i) => i !== s.cursor && open(x));
  return nx ? `${nx.name} · ${scheme(nx)}` : 'Last one. Finish strong.';
}
const dots = (e) => h('div', { class: 'dots', role: 'img', 'aria-label': `${e.logged.length} of ${e.sets} done` },
  Array.from({ length: e.sets }, (_, i) => h('div', { class: 'dot' + (i < e.logged.length ? ' done' : i === e.logged.length ? ' now' : '') })));

function overdueNote(s) {
  if (!s.restOver) return null;
  const sec = (Date.now() - s.restOver) / 1000;
  return sec > 5 && sec < 3600 ? h('div', { class: 'gold small' }, `Rest ended ${mmss(sec)} ago.`) : null;
}

// ---------- one-tap set logging (SES-02..05) ----------
function setView(s, e) {
  const v = { ...pendingFor(e) }, w = e.rule === RULE.DOUBLE, n = e.logged.length;
  if (w && v.load == null) v.load = e.equip === 'barbell' ? settings().bar : e.inc * 3;
  const doneTxt = h('span', {});
  const done = h('button', { class: 'btn gold xl', onclick: () => doLog(s, v) }, ok(), doneTxt);
  const plateBox = h('div', { class: 'plates' });
  const relabel = () => { doneTxt.textContent = `DONE ${shortVal(e, v)}`; if (w && hasPlates(e)) fillPlates(plateBox, v.load); };
  const changed = () => { e.pending = { ...v }; saveSoon(s); relabel(); };
  relabel();
  const last = lastText(e);
  return h('div', { class: 'screen' }, header(s), pumpRow(s),
    h('div', { class: `panel ${s.dayType === 'LOWER' ? 'ox' : 'navy'}` },
      h('div', { class: 'row top' }, h('div', { class: 'h1' }, nameWithVariant({ name: up(e), variant: e.variant })), h('span', { class: 'label gold', style: 'white-space:nowrap' }, `SET ${n + 1} / ${e.sets}`)),
      h('div', { class: 'row' }, h('span', { class: 'mute' }, 'Target'), h('span', {}, `${targetText(e)} × ${e.reps}`)),
      last && h('div', { class: 'row' }, h('span', { class: 'mute' }, 'Last time'), h('span', {}, last)),
      e.first && w && h('div', { class: 'gold small' }, 'First time with this setup. Set the load once and it is remembered.'),
      EXERCISES[e.ex] && EXERCISES[e.ex].each && h('div', { class: 'mute small' }, 'Weight per dumbbell.'),
      overdueNote(s)),
    e.suggestAdd && n === 0 && h('button', { class: 'btn line-gold', onclick: () => { e.pending = { ...v, ext: v.ext + e.inc }; e.suggestAdd = false; commit(s); } }, `ALL REPS HIT LAST TIME · ADD ${kg(e.inc)} KG`),
    h('div', { class: 'push stack', style: 'gap:14px' },
      w && hasPlates(e) && plateBox,
      w && stepper({ value: v.load, step: e.inc, fmt: (x) => `${kg(x)} kg`, label: 'weight', onChange: (x) => { v.load = x; changed(); } }),
      e.rule === RULE.BW && stepper({ value: v.ext, step: e.inc, fmt: (x) => (x ? `BW + ${kg(x)} kg` : 'bodyweight'), label: 'added weight', onChange: (x) => { v.ext = x; changed(); } }),
      stepper({ value: v.reps, step: 1, fmt: (x) => `${x} reps`, label: 'reps', onChange: (x) => { v.reps = x; changed(); } }),
      done, footer(s, e)));
}
function footer(s, e) {
  return [
    h('div', { class: 'row' }, dots(e), h('button', { class: 'btn', style: 'width:auto', disabled: !setsLogged(s), onclick: () => doUndo(s) }, 'Undo last set')),
    h('div', { class: 'row small', style: 'border-top:2px solid var(--line);padding-top:12px' }, h('span', { class: 'mute' }, 'Next'), h('span', { style: 'text-align:right' }, nextInfo(s))),
  ];
}

// ---------- rest and transition timer (TIM-01..06) ----------
function restView(s, e) {
  const t = s.timer, st = settings(), isRest = t.kind === 'rest', v = pendingFor(e);
  const time = h('div', { class: 'time gold', role: 'timer' });
  const fill = h('div'), quote = h('div', { class: 'quote' }), by = h('div', { class: 'mute small' });
  const pillars = visiblePillars(), st0 = stage() + (setsLogged(s) >= setsPlanned(s) ? 1 : 0), man = hero(st0, 128);
  const paint = () => {
    const rem = (t.endsAt - Date.now()) / 1000;
    time.textContent = clock(rem);
    fill.style.width = `${Math.max(0, Math.min(100, (1 - rem / Math.max(1, t.total)) * 100))}%`;
    if (st.pillars) { const p = pillars[(Math.floor(t.startedAt / 7000) + Math.floor((Date.now() - t.startedAt) / 20000)) % pillars.length]; if (quote.textContent !== p.text) { quote.textContent = p.text; by.textContent = p.author ? `— ${p.author}` : ''; } }
    const src = heroSrc(st0, Math.floor(Date.now() / 600) % 2 === 1); if (!man.src.endsWith(src)) man.src = src;   // he flexes while you rest
    return rem;
  };
  paint();
  setTicker(() => {
    const rem = paint();
    if (st.tick && rem <= 10 && rem > 9 && !t.ticked) { t.ticked = true; tick(); }
    if (rem <= 0) {
      s.timer = null; s.restOver = t.endsAt; saveSession(s);
      if (rem > -3) { if (st.bell) bell(st.bellTone); if (st.flash) flash(); }
      render();
    }
  });
  return h('div', { class: 'screen' }, header(s, isRest ? 'REST' : 'NEXT EXERCISE'),
    h('div', { class: 'label center' }, isRest ? `${up(e)} · ${e.logged.length} OF ${e.sets} DONE` : `UP NEXT · ${up(e)}`),
    time, h('div', { class: 'bar' }, fill),
    h('div', { style: 'display:flex;justify-content:center' }, man),
    st.pillars && h('div', { class: 'panel' }, quote, by),
    h('div', { class: 'row' }, h('span', { class: 'mute' }, 'Next'), h('span', { style: 'text-align:right' }, isRest ? `${e.stages ? 'Stage' : 'Set'} ${e.logged.length + 1} · ${describe(e, v)}` : describe(e, v))),
    h('div', { class: 'push stack' },
      h('div', { class: 'capsule' },
        h('button', { onclick: () => { adjustTimer(s, -15); commit(s); } }, '−15 s'),
        h('button', { class: 'skip', onclick: () => { s.timer = null; commit(s); } }, 'SKIP'),
        h('button', { onclick: () => { adjustTimer(s, 15); commit(s); } }, '+15 s')),
      h('button', { class: 'btn', onclick: () => doUndo(s) }, 'Undo last set')));
}

// ---------- breathing squat mode (SES-09): the phone is a display while the bar is on his back ----------
function squatView(s, e) {
  const st = settings(), v = { ...pendingFor(e) };
  if (v.load == null) v.load = st.bar;
  const q = e.squat || (e.squat = { phase: 'ready', safe: !st.safety });
  const top = h('div', { class: 'row' }, h('span', { class: 'label' }, 'BREATHING SQUAT'), h('span', { class: 'label' }, '1 × 20'));

  if (q.phase === 'ready') {
    const plateBox = h('div', { class: 'plates' }); fillPlates(plateBox, v.load);
    const last = lastText(e);
    return h('div', { class: 'screen black' }, header(s), top,
      stepper({ value: v.load, step: e.inc, fmt: (x) => `${kg(x)} kg`, label: 'weight', onChange: (x) => { v.load = x; e.pending = { ...v }; saveSoon(s); fillPlates(plateBox, x); } }),
      plateBox,
      last && h('div', { class: 'row' }, h('span', { class: 'mute' }, 'Last time'), h('span', {}, last)),
      e.first && h('div', { class: 'gold small' }, 'First squat in the app. Set the load once and it is remembered.'),
      h('div', { class: 'panel' }, h('div', { class: 'label gold' }, 'Before you step under'),
        h('div', {}, 'Three deep breaths between reps. One more gulp, then down. Blow out on the way up.'),
        h('div', { class: 'mute small' }, 'Prop the phone where you can see it. You will not need to touch it.')),
      h('button', { class: 'btn', onclick: () => rehearse(v.load) }, 'Two-minute rehearsal first'),
      h('div', { class: 'push stack' },
        st.safety && h('button', { class: 'btn' + (q.safe ? ' on' : ''), 'aria-pressed': q.safe ? 'true' : 'false', onclick: () => { q.safe = !q.safe; commit(s); } }, q.safe ? [ok(), 'Safeties set'] : 'Safeties set? Tap to confirm'),
        h('button', { class: 'btn gold xl', disabled: !q.safe, onclick: () => { q.phase = 'under'; q.unrackedAt = Date.now(); e.pending = { ...v }; commit(s); } }, 'UNRACK')));
  }

  if (q.phase === 'fewer') {
    let reps = q.reps ?? 19;
    const dur = Math.round((q.rackedAt - q.unrackedAt) / 1000);
    const btn = h('button', { class: 'btn gold xl', onclick: () => doLog(s, { reps, load: v.load, durationSec: dur }) }, `LOG ${reps} REPS`);
    return h('div', { class: 'screen black' }, top,
      h('div', { class: 'big gold center', style: 'margin-top:24px' }, `${kg(v.load)} KG`),
      h('div', { class: 'center' }, 'How many did you get?'),
      stepper({ value: reps, step: 1, max: 19, fmt: (x) => `${x} reps`, label: 'reps', onChange: (x) => { reps = x; q.reps = x; btn.textContent = `LOG ${x} REPS`; saveSoon(s); } }),
      h('div', { class: 'mute small center' }, 'The weight stays the same next time. Two misses in a row and it drops ten percent.'),
      h('div', { class: 'push stack' }, btn, h('button', { class: 'btn', onclick: () => { q.phase = 'under'; commit(s); } }, 'Back')));
  }

  const time = h('div', { class: 'time', role: 'timer' }), cue = h('div', { class: 'cue' });
  const paint = () => {
    const el = (Date.now() - q.unrackedAt) / 1000;
    time.textContent = mmss(el);
    const c = el >= 120 ? POWER : SQUAT_CUES[Math.min(SQUAT_CUES.length - 1, Math.floor(el / 30))];
    if (cue.textContent !== c) cue.textContent = c;
  };
  paint(); setTicker(paint);
  return h('div', { class: 'screen black' }, top,
    h('div', { class: 'big gold center', style: 'font-size:30px' }, `${kg(v.load)} KG`),
    h('div', { class: 'stack', style: 'gap:6px;padding:8px 0' }, time, h('div', { class: 'label center' }, 'UNDER THE BAR')),
    cue,
    h('div', { class: 'center' }, 'Three deep breaths. One more gulp. Down. Blow out on the way up.'),
    h('div', { class: 'push stack' },
      h('button', { class: 'btn gold xl', onclick: () => { if (settings().flash) flash(); doLog(s, { reps: 20, load: v.load, durationSec: Math.round((Date.now() - q.unrackedAt) / 1000) }); } }, 'RACKED · 20 REPS', ok('after')),
      h('div', { class: 'grid2' },
        h('button', { class: 'btn', onclick: () => { q.phase = 'fewer'; q.rackedAt = Date.now(); commit(s); } }, 'Fewer than 20'),
        h('button', { class: 'btn', onclick: () => { q.phase = 'ready'; commit(s); } }, 'Not started'))));
}

// ---------- protocol runner (SES-10): staged sets with holds ----------
function protocolView(s, e) {
  const k = e.logged.length, stg = e.stages[k], v = { ...pendingFor(e) }, st = settings();
  if (v.load == null) v.load = e.inc * 4;
  const fixed = typeof stg.hold === 'number';
  const log = (holdSec) => doLog(s, { reps: stg.reps, load: v.load, holdSec });
  const head = [header(s), pumpRow(s),
    h('div', { class: 'row top' }, h('div', { class: 'h1' }, up(e)), h('span', { class: 'label gold', style: 'white-space:nowrap' }, `STAGE ${k + 1} / ${e.sets}`))];

  if (e.hold) {
    const time = h('div', { class: 'time gold', role: 'timer' });
    const paint = () => { const el = (Date.now() - e.hold.startedAt) / 1000; time.textContent = fixed ? clock(stg.hold - el) : mmss(el); return el; };
    paint();
    setTicker(() => { const el = paint(); if (fixed && el >= stg.hold) { if (st.bell) bell(st.bellTone); if (st.flash) flash(); log(stg.hold); } });
    return h('div', { class: 'screen' }, head,
      h('div', { class: 'cue' }, fixed ? 'Hold. Highest tension.' : 'Hold. As long as you can.'),
      time,
      h('div', { class: 'push stack' },
        h('button', { class: 'btn gold xl', onclick: () => log(Math.round((Date.now() - e.hold.startedAt) / 1000)) }, fixed ? 'LOST IT EARLY' : 'RELEASED'),
        h('button', { class: 'btn', onclick: () => { e.hold = null; commit(s); } }, 'Back to the reps')));
  }

  const last = lastText(e);
  return h('div', { class: 'screen' }, head,
    h('div', { class: `panel ${s.dayType === 'LOWER' ? 'ox' : 'navy'}` },
      h('div', { class: 'big' }, `${stg.reps} REPS`),
      h('div', {}, stg.hold == null ? (stg.label ? `${stg.label}. Then rest.` : 'Then rest.') : fixed ? `Then hold ${stg.hold} seconds at the point of highest tension.` : 'Then hold as long as you can at the point of highest tension.'),
      last && k === 0 && h('div', { class: 'row' }, h('span', { class: 'mute' }, 'Last time'), h('span', {}, last)),
      overdueNote(s)),
    h('div', { class: 'push stack', style: 'gap:14px' },
      stepper({ value: v.load, step: e.inc, fmt: (x) => `${kg(x)} kg`, label: 'weight', onChange: (x) => { v.load = x; e.pending = { ...v }; saveSoon(s); } }),
      h('button', { class: 'btn gold xl', onclick: () => { if (stg.hold == null) return log(null); haptic(); e.hold = { startedAt: Date.now() }; e.pending = { ...v }; commit(s); } }, stg.hold == null ? [ok(), `STAGE DONE · ${stg.reps} REPS`] : 'REPS DONE · START HOLD'),
      footer(s, e)));
}

// ---------- menu: undo, skip, reorder, add, note, end (SES-01, SES-13) ----------
function menu(s) {
  const e = cur(s);
  sheet((close) => {
    let armed = false;
    const act = (fn) => () => { close(); fn(); };
    const end = h('button', { class: 'btn', onclick: () => {
      if (!armed) { armed = true; end.textContent = 'Tap again to end the session'; end.classList.add('on'); return; }
      close();
      if (!setsLogged(s)) { deleteSession(s.id); closeSession(); go('today'); return; }
      endNow(s, Date.now()); commit(s);
    } }, 'End session now');
    const note = h('textarea', { 'aria-label': 'Session note', placeholder: 'Note for this session' });
    note.value = s.notes || '';
    note.addEventListener('input', () => { s.notes = note.value; saveSoon(s); });
    return [
      h('div', { class: 'label gold' }, e.name),
      h('button', { class: 'btn', disabled: !setsLogged(s), onclick: act(() => doUndo(s)) }, 'Undo last set'),
      h('button', { class: 'btn', onclick: act(() => { if (doLater(s)) commit(s); }) }, 'Do this exercise later'),
      h('button', { class: 'btn', onclick: act(() => { skip(s, Date.now()); commit(s); }) }, 'Skip this exercise'),
      h('button', { class: 'btn', onclick: act(() => addMenu(s)) }, 'Add an exercise'),
      note, end,
      h('button', { class: 'btn line-gold', onclick: close }, 'CLOSE'),
    ];
  });
}
function addMenu(s) {
  sheet((close) => [
    h('div', { class: 'label gold' }, 'Add after this exercise'),
    Object.entries(EXERCISES).filter(([id]) => id !== 'squat' && id !== 'legext').map(([id, def]) => h('button', { class: 'btn', onclick: () => {
      const bw = def.rule === RULE.BW || def.rule === RULE.UNW;
      const one = buildSession({ id: 'extra', dayType: s.dayType, items: [{ ex: id, sets: bw ? 2 : 3, reps: bw ? 20 : 12 }] }, EXERCISES, PROTOCOLS, S.sessions, { today: s.date });
      addExercise(s, one.exercises[0]); close(); commit(s);
    } }, def.name)),
    h('button', { class: 'btn line-gold', onclick: close }, 'CLOSE'),
  ]);
}

// ---------- summary and spa quick log (SES-17, SPA-01) ----------
function summary(s) {
  if (!setsLogged(s)) { deleteSession(s.id); closeSession(); setTimeout(() => go('today')); return h('div', { class: 'screen' }); }
  const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));
  const did = s.exercises.filter((x) => x.logged.length), sq = did.find(isSquat), pumped = setsLogged(s) >= setsPlanned(s);
  let headline = 'DONE.', line = `${did.length} exercises. ${setsLogged(s)} sets.`;
  if (sq) {
    const l = sq.logged[0], delta = sq.last && sq.last.load != null ? l.load - sq.last.load : 0;
    headline = l.reps >= 20 ? 'TWENTY. RACKED.' : `${l.reps} OF 20.`;
    line = `Squat ${kg(l.load)} kg × ${l.reps}.` + (l.reps >= 20 && delta > 0 ? ` Up ${kg(delta)} kg on last time.` : l.reps < 20 ? ' Same weight next time.' : '');
  }
  const tpl = templateById(s.templateId);
  const nxt = tpl ? buildSession(tpl, EXERCISES, PROTOCOLS, S.sessions, { today: s.date }).exercises.filter((x) => weighted(x) && x.target.load != null).slice(0, 4) : [];
  return h('div', { class: 'screen' },
    h('div', { class: 'label' }, `${s.dayType} BODY DAY · COMPLETE`),
    h('div', { class: 'row', style: 'justify-content:flex-start;gap:14px' }, hero(stage() + (pumped ? 1 : 0), 112, 'hero-box', true),
      h('div', { class: 'stack', style: 'gap:10px' }, h('div', { class: 'h1 gold' }, headline), h('div', {}, line))),
    h('div', { class: 'grid3' }, [[did.length, 'exercises'], [setsLogged(s), 'sets'], [mins, 'minutes']].map(([n, l]) => h('div', { class: 'panel', style: 'align-items:center;padding:12px 6px;gap:6px' }, h('div', { class: 'num', style: 'font-size:16px' }, n), h('div', { class: 'mute small' }, l)))),
    nxt.length > 0 && h('div', { class: 'panel' }, h('div', { class: 'label' }, `NEXT ${s.dayType} DAY`),
      nxt.map((x) => h('div', { class: 'list-row' }, h('span', {}, `${x.name} · ${scheme(x)}`), h('span', { class: 'gold', style: 'white-space:nowrap' }, `${kg(x.target.load)} kg`)))),
    h('div', { class: 'panel ox' }, h('div', { class: 'label' }, 'RECOVERY · PHONE STAYS OUTSIDE'), spaCard(s.date, s.id)),
    h('div', { class: 'push grid2' },
      h('button', { class: 'btn', onclick: () => doUndo(s) }, 'Undo last set'),
      h('button', { class: 'btn on', onclick: () => { closeSession(); go('today'); } }, 'Back to Today')));
}

// ---------- mental rehearsal before the squat (MEN-01): text and a quiet two-minute clock ----------
function rehearse(load) {
  sheet((close) => {
    const clockEl = h('div', { class: 'big gold center' }, '2:00'), end = Date.now() + 120000;
    const iv = setInterval(() => { if (!clockEl.isConnected) return clearInterval(iv); clockEl.textContent = clock((end - Date.now()) / 1000); }, 250);
    return [
      h('div', { class: 'label gold' }, 'See it before you lift it'), clockEl,
      h('div', {}, '1. Sit down. Breathe low and slow, into the belly.'),
      h('div', {}, '2. Let your arms and legs go warm and heavy.'),
      h('div', {}, `3. See the rack. See ${kg(load)} kg on the bar. Step under it.`),
      h('div', {}, '4. Count all twenty, one at a time. Feel the breaths between them.'),
      h('div', {}, '5. See the last rep go up. Rack it.'),
      h('button', { class: 'btn line-gold', onclick: () => { clearInterval(iv); close(); } }, 'READY'),
    ];
  });
}

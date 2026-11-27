// Today: what is due, the targets, start, fuel, weigh-in with trend, recovery.
import { h, kg, stepper, ok, bar, niceDate } from '../dom.js';
import { S, settings, saveSession, setKV, saveWeight, deleteWeight, activeSession, uid, today } from '../state.js';
import { buildSession, layoffFactor, daysBetween } from '../engine/progression.js';
import { nextDayType, lastOfType } from '../engine/schedule.js';
import { ma7, weeklyRate, inWindow, dayTotals } from '../engine/nutrition.js';
import { EXERCISES, PROTOCOLS } from '../../seed/program.js';
import { templateFor, forgeNow } from '../program.js';
import { STAGES } from '../engine/forge.js';
import { recoveryLight, squatStalled } from '../engine/recovery.js';
import { saveDay } from '../state.js';
import { unlockAudio, haptic } from '../platform/device.js';
import { go, render, sheet } from '../app.js';
import { hero, stage, targetText, scheme, nameWithVariant } from './common.js';
import { spaCard, recoveryExtras } from './recovery.js';
import { plan, dayDoc, targetFor } from './eat.js';

const w1 = (x) => Number(x).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let weightT = null;

function weighIns() {
  sheet((close) => {
    const list = [...S.weights].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60);
    return [
      h('div', { class: 'label gold' }, 'Weigh-ins'),
      !list.length && h('div', { class: 'mute' }, 'None yet.'),
      list.map((w) => h('div', { class: 'row' }, h('span', {}, niceDate(w.date)), h('span', { class: 'row', style: 'gap:10px' }, h('span', { class: 'num', style: 'font-size:12px' }, `${w1(w.kg)} kg`),
        h('button', { class: 'btn tight', style: 'width:auto', 'aria-label': `Remove ${niceDate(w.date)}`, onclick: async () => { await deleteWeight(w.id); close(); render(); } }, 'Remove')))),
      h('button', { class: 'btn line-gold', onclick: close }, 'CLOSE'),
    ];
  });
}

export function todayView() {
  const d = today(), st = settings(), a = activeSession();
  const ov = S.kv.dayOverride, due = ov && ov.date === d ? ov.type : nextDayType(S.sessions), other = due === 'UPPER' ? 'LOWER' : 'UPPER';
  const tpl = templateFor(due);
  const last = lastOfType(S.sessions, due), gap = last ? daysBetween(last.date, d) : null, factor = layoffFactor(gap);
  const preview = buildSession(tpl, EXERCISES, PROTOCOLS, S.sessions, { today: d });
  const lead = preview.exercises.find((e) => e.target.load != null);
  const trained = S.sessions.some((s) => s.status === 'COMPLETED' && s.date === d && !s.imported);

  const start = (f) => {
    const s = buildSession(tpl, EXERCISES, PROTOCOLS, S.sessions, { today: d, layoff: f, id: uid(), now: Date.now(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    unlockAudio(st.loud); haptic();
    saveSession(s); setKV('activeSessionId', s.id); setKV('dayOverride', null);
    go('session');
  };
  const onStart = () => {
    if (a) return go('session');
    if (factor < 1) return sheet((close) => [
      h('div', { class: 'label gold' }, 'Back after a break'),
      h('div', {}, `${gap} days since your last ${due.toLowerCase()} body day. Starting lighter is a suggestion, not a rule.`),
      h('button', { class: 'btn gold', onclick: () => { close(); start(factor); } }, `START ${Math.round((1 - factor) * 100)}% LIGHTER`),
      h('button', { class: 'btn', onclick: () => { close(); start(1); } }, 'Keep my loads'),
      h('button', { class: 'btn', onclick: close }, 'Cancel'),
    ]);
    start(1);
  };

  // fuel (TOD-03)
  const p = plan(), day = dayDoc(d), tot = dayTotals(day), kcalTarget = targetFor(day, p);

  // hero stage and morning check-in (REC-01, REC-02)
  const f = forgeNow(), seen = S.kv.stageSeen || 1;
  const squats = S.sessions.filter((s) => s.status === 'COMPLETED' && s.dayType !== 'FULL').sort((x, y) => (x.date < y.date ? -1 : 1)).flatMap((s) => s.exercises.filter((e) => e.ex === 'squat' && e.logged.length).map((e) => e.logged[0].load));
  const pulses = S.days.filter((x) => x.check && x.check.pulse && x.date < d && daysBetween(x.date, d) <= 14).map((x) => x.check.pulse);
  const light = day.check ? recoveryLight(day.check, pulses, squatStalled(squats)) : null;
  const ADVICE = { GREEN: 'Green. Train.', AMBER: 'Amber. Train; consider dropping the last set of the small lifts.', RED: 'Red. Consider a rest day. Your call.' };
  const checkIn = () => sheet((close) => {
    const lastPulse = pulses.length ? pulses[pulses.length - 1] : 60;
    const c = { sleep: 8, pulse: lastPulse, ache: false, ...(day.check || {}) };
    let measured = !day.check || !!day.check.pulse;
    if (!c.pulse) c.pulse = lastPulse;
    const ache = h('button', { class: 'btn', 'aria-pressed': 'false', onclick: () => { c.ache = !c.ache; ache.classList.toggle('on', c.ache); ache.setAttribute('aria-pressed', String(c.ache)); ache.textContent = c.ache ? 'Deep muscle ache: yes' : 'Deep muscle ache: no'; } }, c.ache ? 'Deep muscle ache: yes' : 'Deep muscle ache: no');
    if (c.ache) ache.classList.add('on');
    const skip = h('button', { class: 'btn tight', onclick: () => { measured = !measured; skip.textContent = measured ? 'I did not take my pulse' : 'Pulse not counted today'; skip.classList.toggle('on', !measured); } }, 'I did not take my pulse');
    return [
      h('div', { class: 'label gold' }, 'Morning check'),
      h('div', { class: 'mute small' }, 'Hours slept'),
      h('div', { class: 'stepper sm' }, stepper({ value: c.sleep, step: 0.5, min: 0, max: 14, fmt: (x) => `${x} h`, label: 'hours slept', onChange: (x) => { c.sleep = x; } })),
      h('div', { class: 'mute small' }, 'Resting pulse on waking'),
      h('div', { class: 'stepper sm' }, stepper({ value: c.pulse, step: 1, min: 30, max: 120, fmt: (x) => `${x} bpm`, label: 'resting pulse', onChange: (x) => { c.pulse = x; measured = true; } })),
      skip, ache,
      h('button', { class: 'btn on', onclick: async () => { day.check = { sleep: c.sleep, pulse: measured ? c.pulse : null, ache: c.ache }; await saveDay(day); close(); render(); } }, 'Save'),
      h('button', { class: 'btn line-gold', onclick: close }, 'CLOSE'),
    ];
  });

  // weigh-in and trend (BOD-01, BOD-02)
  const wToday = S.weights.find((w) => w.date === d), lastW = [...S.weights].sort((x, y) => (x.date < y.date ? -1 : 1)).at(-1);
  let val = wToday ? wToday.kg : lastW ? lastW.kg : S.kv.startWeight || 75;
  const wStatus = h('div', { class: 'small ' + (wToday ? 'gold' : 'mute') }, wToday ? [ok(), 'Logged today'] : 'Not logged today');
  const logBtn = wToday ? null : h('button', { class: 'btn', onclick: () => saveW(true) }, 'Log this weight');
  const saveW = async (redraw) => { await saveWeight({ id: 'w-' + d, date: d, measuredAt: new Date().toISOString(), kg: val }); if (redraw) return render(); wStatus.replaceChildren(ok(), 'Logged today'); wStatus.className = 'small gold'; if (logBtn) logBtn.remove(); };
  const avg = ma7(S.weights, d), rate = weeklyRate(S.weights, d), have = inWindow(S.weights, d);
  const trend = avg != null
    ? `7-day average ${w1(avg)} kg` + (rate != null ? ` · ${signed(rate)} kg on last week` : ' · weekly change after a second week')
    : `${4 - have} more weigh-in${4 - have === 1 ? '' : 's'} this week for the 7-day average`;

  const own = S.sessions.filter((s) => s.status === 'COMPLETED' && !s.imported).length;
  const backupAge = S.kv.lastBackupAt ? daysBetween(S.kv.lastBackupAt.slice(0, 10), d) : null;

  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'row' }, h('div', { class: 'label' }, new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })), h('div', { class: 'label gold' }, trained ? [ok(), 'TRAINED TODAY'] : 'ACHILLES')),
    S.updateReady && h('button', { class: 'btn line-gold', onclick: () => go('settings') }, 'UPDATE READY · OPEN SETTINGS'),
    h('div', { class: 'banner ' + due }, hero(stage(), 96, 'hero-box'),
      h('div', { class: 'stack', style: 'gap:10px;min-width:0' },
        h('div', { class: 'h1' }, due, h('br'), 'BODY DAY'),
        h('div', {}, lead ? `${lead.name} ${kg(lead.target.load)} kg × ${lead.reps || lead.stages[0].reps}.` + (lead.last && !lead.first ? ` Last time ${kg(lead.last.load)}.` : '') : 'First session: you set each load once.'))),
    h('button', { class: 'btn gold', onclick: onStart }, a ? (a.status === 'ACTIVE' ? 'RESUME SESSION' : 'SESSION SUMMARY') : 'START SESSION'),
    !a && h('button', { class: 'btn', onclick: () => { setKV('dayOverride', { date: d, type: other }); render(); } }, `Switch to ${other.toLowerCase()} body day`),
    f && f.stage > seen && h('div', { class: 'panel goldline', style: 'align-items:center;text-align:center' }, hero(f.stage, 128, '', true),
      h('div', { class: 'h1 gold' }, `NEW STAGE: ${STAGES[f.stage - 1]}`), h('div', {}, 'Earned with the bar and the scale. Nothing else moves him.'),
      h('button', { class: 'btn on', onclick: async () => { await setKV('stageSeen', f.stage); render(); } }, 'Onward')),
    h('button', { class: 'btn line-gold', onclick: () => go('progress') }, f ? `STAGE ${f.stage} · ${STAGES[f.stage - 1]} · FORGE ${f.score}%` : 'SET A GOAL WEIGHT TO WAKE THE HERO'),
    h('div', { class: 'panel' }, h('div', { class: 'row' }, h('div', { class: 'label' }, 'MORNING CHECK'), light && h('div', { class: 'label ' + (light.light === 'GREEN' ? 'gold' : '') }, light.light)),
      light ? h('div', {}, ADVICE[light.light] + (light.why.length ? ` (${light.why.join(', ')})` : '')) : h('div', { class: 'mute small' }, 'Sleep, pulse, deep ache. Ten seconds; a suggestion, never a stop sign.'),
      h('button', { class: 'btn', onclick: checkIn }, light ? 'Change' : 'Check in')),
    !S.sessions.length && h('div', { class: 'panel goldline' }, h('div', { class: 'label gold' }, 'No history yet'), h('div', {}, 'Import your setup file in Settings to bring in your latest loads. Or just start: each lift asks for its load once.')),
    h('div', { class: 'panel' }, h('div', { class: 'label' }, "TODAY'S TARGETS"),
      preview.exercises.map((e) => h('div', { class: 'list-row' }, h('span', {}, nameWithVariant(e), h('span', { class: 'mute' }, ` · ${scheme(e)}`)), h('span', { class: 'gold', style: 'white-space:nowrap' }, targetText(e))))),
    h('button', { class: 'panel', style: 'text-align:left;width:100%', 'aria-label': 'Open the eating log', onclick: () => go('eat') },
      h('div', { class: 'row' }, h('div', { class: 'label' }, 'FUEL'), h('div', { class: 'mute small' }, kcalTarget ? `${tot.eaten} of ${p ? p.slots.length : 0} meals` : 'no plan yet')),
      h('div', { class: 'row top' }, h('div', { class: 'num', style: 'font-size:16px' }, Math.round(tot.kcal).toLocaleString()), h('div', { class: 'mute small' }, kcalTarget ? `of ${kcalTarget.toLocaleString()} kcal` : 'kcal today')),
      kcalTarget > 0 && bar(tot.kcal / kcalTarget * 100, 'thin')),
    h('div', { class: 'panel' }, h('div', { class: 'row' }, h('div', { class: 'label' }, 'WEIGH-IN'), wStatus),
      h('div', { class: 'stepper sm' }, stepper({ value: val, step: 0.1, min: 30, max: 200, fmt: (x) => `${w1(x)} kg`, label: 'body weight', onChange: (x) => { val = x; clearTimeout(weightT); weightT = setTimeout(() => saveW(false), 600); } })),
      logBtn,
      h('div', { class: 'row' }, h('div', { class: 'mute small' }, trend), S.weights.length > 0 && h('button', { class: 'btn tight', style: 'width:auto;flex:none', onclick: weighIns }, 'All'))),
    h('div', { class: 'panel' }, h('div', { class: 'label' }, 'RECOVERY'), spaCard(d, null), recoveryExtras(d)),
    own > 0 && (backupAge == null || backupAge > 7) && h('button', { class: 'btn', onclick: () => go('settings') }, backupAge == null ? 'No backup yet · Back up' : `Last backup ${backupAge} days ago · Back up`));
}

// Today: what is due, the targets, start, fuel, weigh-in with trend, recovery.
import { h, kg, stepper, ok, bar, niceDate } from '../dom.js';
import { S, settings, saveSession, setKV, saveWeight, deleteWeight, activeSession, uid, today } from '../state.js';
import { buildSession, layoffFactor, daysBetween } from '../engine/progression.js';
import { nextDayType, lastOfType } from '../engine/schedule.js';
import { ma7, weeklyRate, inWindow, dayTotals } from '../engine/nutrition.js';
import { EXERCISES, TEMPLATES, PROTOCOLS } from '../../seed/program.js';
import { unlockAudio, haptic } from '../platform/device.js';
import { go, render, sheet } from '../app.js';
import { hero, stage, targetText, scheme, nameWithVariant } from './common.js';
import { spaCard, recoveryExtras } from './recovery.js';
import { plan, dayDoc, targetFor } from './eat.js';

export function templateFor(type) {
  if (type === 'LOWER') return TEMPLATES.find((t) => t.id === 'lower');
  return TEMPLATES.find((t) => t.id === settings().upperTemplate && t.dayType === 'UPPER') || TEMPLATES.find((t) => t.dayType === 'UPPER');
}
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

// Today: what is due, the targets, start, weigh-in, spa.
import { h, kg, stepper, ok } from '../dom.js';
import { S, settings, saveSession, setKV, saveWeight, saveRecovery, activeSession, uid, today } from '../state.js';
import { buildSession, layoffFactor, daysBetween } from '../engine/progression.js';
import { nextDayType, lastOfType } from '../engine/schedule.js';
import { EXERCISES, TEMPLATES, PROTOCOLS } from '../../seed/program.js';
import { unlockAudio, haptic } from '../platform/device.js';
import { go, render, sheet } from '../app.js';
import { hero, stage, targetText, scheme, nameWithVariant } from './common.js';

export function templateFor(type) {
  if (type === 'LOWER') return TEMPLATES.find((t) => t.id === 'lower');
  return TEMPLATES.find((t) => t.id === settings().upperTemplate && t.dayType === 'UPPER') || TEMPLATES.find((t) => t.dayType === 'UPPER');
}
const w1 = (x) => Number(x).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let weightT = null;

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

  // weigh-in (BOD-01)
  const wToday = S.weights.find((w) => w.date === d), lastW = [...S.weights].sort((x, y) => (x.date < y.date ? -1 : 1)).at(-1);
  let val = wToday ? wToday.kg : lastW ? lastW.kg : S.kv.startWeight || 75;
  const wStatus = h('div', { class: 'small ' + (wToday ? 'gold' : 'mute') }, wToday ? [ok(), 'Logged today'] : 'Not logged today');
  const logBtn = wToday ? null : h('button', { class: 'btn', onclick: () => saveW() }, 'Log this weight');
  const saveW = () => { saveWeight({ id: 'w-' + d, date: d, measuredAt: new Date().toISOString(), kg: val }); wStatus.replaceChildren(ok(), 'Logged today'); wStatus.className = 'small gold'; if (logBtn) logBtn.remove(); };

  // spa (SPA-01)
  const heat = S.recovery.filter((r) => r.date === d && (r.type === 'SAUNA' || r.type === 'HAMMAM'));
  const logSpa = () => {
    const now = new Date().toISOString();
    if (st.sauna > 0) saveRecovery({ id: uid(), date: d, type: 'SAUNA', durationMin: st.sauna, loggedAt: now });
    if (st.hammam > 0) saveRecovery({ id: uid(), date: d, type: 'HAMMAM', durationMin: st.hammam, loggedAt: now });
    haptic(); render();
  };

  const own = S.sessions.filter((s) => s.status === 'COMPLETED' && !s.imported).length;
  const backupAge = S.kv.lastBackupAt ? daysBetween(S.kv.lastBackupAt.slice(0, 10), d) : null;

  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'row' }, h('div', { class: 'label' }, new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })), h('div', { class: 'label gold' }, trained ? [ok(), 'TRAINED TODAY'] : 'ACHILLES')),
    h('div', { class: 'banner ' + due }, hero(stage(), 96, 'hero-box'),
      h('div', { class: 'stack', style: 'gap:10px;min-width:0' },
        h('div', { class: 'h1' }, due, h('br'), 'BODY DAY'),
        h('div', {}, lead ? `${lead.name} ${kg(lead.target.load)} kg × ${lead.reps || lead.stages[0].reps}.` + (lead.last ? ` Last time ${kg(lead.last.load)}.` : '') : 'First session: you set each load once.'))),
    h('button', { class: 'btn gold', onclick: onStart }, a ? (a.status === 'ACTIVE' ? 'RESUME SESSION' : 'SESSION SUMMARY') : 'START SESSION'),
    !a && h('button', { class: 'btn', onclick: () => { setKV('dayOverride', { date: d, type: other }); render(); } }, `Switch to ${other.toLowerCase()} body day`),
    !S.sessions.length && h('div', { class: 'panel goldline' }, h('div', { class: 'label gold' }, 'No history yet'), h('div', {}, 'Import your setup file in Settings to bring in your latest loads. Or just start: each lift asks for its load once.')),
    h('div', { class: 'panel' }, h('div', { class: 'label' }, "TODAY'S TARGETS"),
      preview.exercises.map((e) => h('div', { class: 'list-row' }, h('span', {}, nameWithVariant(e), h('span', { class: 'mute' }, ` · ${scheme(e)}`)), h('span', { class: 'gold', style: 'white-space:nowrap' }, targetText(e))))),
    h('div', { class: 'panel' }, h('div', { class: 'row' }, h('div', { class: 'label' }, 'WEIGH-IN'), wStatus),
      h('div', { class: 'stepper sm' }, stepper({ value: val, step: 0.1, min: 30, max: 200, fmt: (x) => `${w1(x)} kg`, label: 'body weight', onChange: (x) => { val = x; clearTimeout(weightT); weightT = setTimeout(saveW, 600); } })),
      logBtn),
    h('div', { class: 'panel' }, h('div', { class: 'label' }, 'RECOVERY'),
      heat.length ? h('div', { class: 'gold' }, ok(), `Heat logged today · ${heat.reduce((n, r) => n + r.durationMin, 0)} min`)
        : h('button', { class: 'btn', onclick: logSpa }, `Log sauna ${st.sauna} + hammam ${st.hammam}`)),
    own > 0 && (backupAge == null || backupAge > 7) && h('button', { class: 'btn', onclick: () => go('settings') }, backupAge == null ? 'No backup yet · Back up' : `Last backup ${backupAge} days ago · Back up`));
}

// Progress: the hero's stage, the five lines that move it, lift and weight charts, records.
import { h, kg, stepper, bar } from '../dom.js';
import { S, setKV, today } from '../state.js';
import { STAGES, LINES } from '../engine/forge.js';
import { ma7 } from '../engine/nutrition.js';
import { forgeNow, templates } from '../program.js';
import { render } from '../app.js';
import { heroSrc } from './common.js';

let pick = 'squat|';
const GOAL_KEY = { squat: 'squat', sldl: 'sldl', bench: 'bench', row: 'row', ohp: 'press', hipthrust: 'hipthrust' };
const my = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const dm = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const ts = (iso) => Date.parse(iso + 'T12:00:00Z');

// Small inline SVG chart. series: [{ pts: [[time, value]], color, dots }], goals: [{ y, color }].
function chart(series, goals) {
  const W = 340, H = 130, all = series.flatMap((s) => s.pts);
  let x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0]));
  let y0 = Math.min(...all.map((p) => p[1]), ...goals.map((g) => g.y)), y1 = Math.max(...all.map((p) => p[1]), ...goals.map((g) => g.y));
  if (x1 === x0) x1 = x0 + 1; if (y1 === y0) { y1 += 1; y0 -= 1; }
  const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
  const X = (x) => (4 + (x - x0) / (x1 - x0) * (W - 8)).toFixed(1), Y = (y) => (H - 4 - (y - y0) / (y1 - y0) * (H - 8)).toFixed(1);
  let body = goals.map((g) => `<path d="M0 ${Y(g.y)}H${W}" stroke="${g.color}" stroke-width="1" stroke-dasharray="4 4"/>`).join('');
  for (const s of series) {
    if (s.pts.length > 1) body += `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${s.pts.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>`;
    if (s.dots) body += s.pts.map((p) => `<rect x="${X(p[0]) - 2}" y="${Y(p[1]) - 2}" width="4" height="4" fill="${s.color}"/>`).join('');
  }
  const t = document.createElement('template');
  t.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" style="width:100%;height:auto;display:block" shape-rendering="crispEdges">${body}</svg>`;
  return t.content.firstChild;
}

function liftHistory() {
  const map = new Map();
  const done = S.sessions.filter((s) => s.status === 'COMPLETED').sort((a, b) => (a.date === b.date ? (a.seq || 0) - (b.seq || 0) : a.date < b.date ? -1 : 1));
  for (const s of done) for (const e of s.exercises) {
    if (!e.logged.length || e.logged[0].load == null) continue;
    const key = `${e.ex}|${e.variant || ''}`;
    if (!map.has(key)) map.set(key, { key, ex: e.ex, name: e.name + (e.variant ? ` · ${e.variant}` : ''), pts: [] });
    map.get(key).pts.push({ date: s.date, load: e.logged[0].load, hit: e.logged.length >= e.sets && e.logged.every((l) => l.reps >= (e.top || e.reps)) });
  }
  return map;
}

export function progressView() {
  const f = forgeNow(), g = S.kv.goals || {}, d = today(), hist = liftHistory();
  const goalLine = (key) => (g.lines || []).find((l) => l.line === key);
  const st = f ? f.stage : 1;
  let goalW = g.goalWeight || Math.round(((S.weights.at(-1) || {}).kg || S.kv.startWeight || 75) + 10);

  // lifts worth charting: the current routines first, then anything else with history
  const current = templates().flatMap((t) => t.items.map((it) => `${it.ex}|${it.variant || ''}`));
  const keys = [...new Set([...current, ...hist.keys()])].filter((k) => hist.has(k) && hist.get(k).pts.length > 1);
  if (!keys.includes(pick)) pick = keys[0] || null;
  const lift = pick ? hist.get(pick) : null;
  const gl = lift ? goalLine(GOAL_KEY[lift.ex]) : null;
  const best = lift ? lift.pts.filter((p) => p.hit).reduce((m, p) => (!m || p.load > m.load ? p : m), null) : null;

  const ws = [...S.weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const avg = ws.map((w) => [ts(w.date), ma7(ws, w.date)]).filter((p) => p[1] != null);
  const wg = goalLine('weight');

  const records = [...new Set(current)].map((k) => hist.get(k)).filter(Boolean).map((l) => ({ l, top: l.pts.filter((p) => p.hit).reduce((m, p) => (!m || p.load > m.load ? p : m), null) })).filter((r) => r.top);

  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'row' }, h('div', { class: 'label gold' }, `STAGE ${st} · ${STAGES[st - 1]}`), h('div', { class: 'label' }, f ? `FORGE ${f.score}%` : 'NO GOAL YET')),
    h('div', { style: 'display:grid;grid-template-columns:repeat(6,1fr);gap:6px' }, STAGES.map((name, i) => h('img', { class: 'px', src: heroSrc(i + 1, i + 1 === st), alt: `Stage ${i + 1}, ${name}${i + 1 === st ? ', current' : ''}`, style: `width:100%;aspect-ratio:1;background:var(--panel);border:2px solid ${i + 1 === st ? 'var(--gold)' : 'var(--line)'};opacity:${i + 1 <= st ? 1 : 0.4}` }))),

    h('div', { class: 'panel' }, h('div', { class: 'label' }, 'WHAT MOVES HIM'),
      !f && h('div', {}, 'Set a goal body weight. The hero then measures you against the Super Squats standards at that weight.'),
      f && f.lines.map((l) => {
        const name = LINES.find((x) => x[0] === l.key)[1], gg = goalLine(l.key);
        return h('div', { class: 'stack', style: 'gap:4px' },
          h('div', { class: 'row' }, h('span', {}, name), h('span', { class: 'gold', style: 'white-space:nowrap' }, l.baseline == null ? 'not lifted yet' : `${kg(Math.round(l.current * 10) / 10)} of ${kg(Math.round(l.target * 10) / 10)} kg`)),
          bar(l.p * 100, 'thin'),
          l.baseline != null && h('div', { class: 'mute small' }, `Started at ${kg(l.baseline)}` + (gg ? ` · 1 Jan ${kg(gg.jan)} · 1 Apr ${kg(gg.apr)}` : '')));
      }),
      h('div', { class: 'stepper sm' }, h('span', { style: 'width:92px' }, 'Goal weight'), stepper({ value: goalW, step: 0.5, min: 40, max: 160, fmt: (x) => `${kg(x)} kg`, label: 'goal body weight', onChange: (x) => { goalW = x; } })),
      h('button', { class: 'btn', onclick: async () => { await setKV('goals', { ...g, goalWeight: goalW }); render(); } }, g.goalWeight ? 'Save goal weight' : 'Set goal weight')),

    h('div', { class: 'panel' }, h('div', { class: 'label' }, 'LIFTS'),
      !lift && h('div', { class: 'mute' }, 'A chart appears once a lift has two sessions.'),
      lift && h('div', { class: 'row' }, h('span', {}, lift.name), h('span', { class: 'gold', style: 'white-space:nowrap' }, `${kg(lift.pts.at(-1).load)} kg now`)),
      // one step per session, like the columns of the sheet: a long break does not squash the recent work
      lift && chart([{ pts: lift.pts.map((p, i) => [i, p.load]), color: '#E8B93A', dots: lift.pts.length < 40 }], gl ? [{ y: gl.jan, color: '#4F6FC4' }, { y: gl.apr, color: '#F2EFE8' }] : []),
      lift && h('div', { class: 'mute small' }, `${lift.pts.length} sessions since ${my(lift.pts[0].date)}` + (best ? ` · best ${kg(best.load)} kg (${my(best.date)})` : '') + (gl ? ` · dashed: goals ${kg(gl.jan)} and ${kg(gl.apr)}` : '')),
      keys.length > 1 && h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, keys.map((k) => h('button', { class: 'btn tight' + (k === pick ? ' on' : ''), style: 'width:auto;min-height:44px;font-size:17px', 'aria-pressed': k === pick ? 'true' : 'false', onclick: () => { pick = k; render(); } }, hist.get(k).name)))),

    h('div', { class: 'panel' }, h('div', { class: 'label' }, 'BODY WEIGHT'),
      ws.length < 2 ? h('div', { class: 'mute' }, 'Two weigh-ins start the chart. Four in a week start the 7-day average.')
        : [h('div', { class: 'row' }, h('span', {}, avg.length ? '7-day average' : 'Latest'), h('span', { class: 'gold' }, `${(avg.length ? avg.at(-1)[1] : ws.at(-1).kg).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`)),
          chart([{ pts: ws.map((w) => [ts(w.date), w.kg]), color: '#A3A3B5', dots: true }, { pts: avg, color: '#E8B93A' }], wg ? [{ y: wg.jan, color: '#4F6FC4' }, { y: wg.apr, color: '#F2EFE8' }] : []),
          h('div', { class: 'mute small' }, `${dm(ws[0].date)} to ${dm(ws.at(-1).date)} · grey: each morning · gold: 7-day average` + (wg ? ` · dashed: ${kg(wg.jan)} by 1 Jan, ${kg(wg.apr)} by 1 Apr` : ''))]),

    records.length > 0 && h('div', { class: 'panel' }, h('div', { class: 'label' }, 'BEST WITH EVERY REP MADE'),
      records.map((r) => h('div', { class: 'list-row' }, h('span', {}, r.l.name), h('span', { style: 'white-space:nowrap' }, h('span', { class: 'gold' }, `${kg(r.top.load)} kg`), h('span', { class: 'mute small' }, ` · ${my(r.top.date)}`))))));
}

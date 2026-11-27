import { ma7 } from './nutrition.js';
// Hero stage from real numbers (development instructions §5.6).
export const STAGES = ['MORTAL', 'RECRUIT', 'HOPLITE', 'CHAMPION', 'DEMIGOD', 'ACHILLES'];
export function standards(goalKg) { return { weight: goalKg, squat: 1.5 * goalKg, bench: 1.25 * goalKg, row: 1.25 * goalKg, press: 0.75 * goalKg }; }
export function forgeScore(lines) { // lines: [{ baseline, current, target }]
  const ps = lines.map((l) => (l.target === l.baseline ? 0 : Math.min(1, Math.max(0, (l.current - l.baseline) / (l.target - l.baseline)))));
  return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length * 100);
}
export function stageOf(score) { return score >= 100 ? 6 : Math.floor(score / 20) + 1; }

// ---- the five lines, worked out from what has been logged (development instructions §5.6) ----
export const LINES = [['weight', 'Body weight'], ['squat', 'Squat × 20'], ['bench', 'Bench × 12'], ['row', 'Row × 15'], ['press', 'Press × 10']];
const EX = { squat: 'squat', bench: 'bench', row: 'row', press: 'ohp' };
const allHit = (e) => e.logged.length >= e.sets && e.logged.every((l) => l.reps >= (e.top || e.reps));

// inp: { sessions, weights, startWeight, goalWeight, variants: { bench, press } }
// Baseline = the first load on record for the lift in its current variant; current = the best load
// at which every prescribed rep was made (a high-water mark: a layoff never demotes the hero).
// Sessions from the old 2024–25 sheet (dayType FULL) are history, not part of this climb.
export function forgeLines(inp) {
  if (!inp.goalWeight) return null;
  const t = standards(inp.goalWeight), out = [];
  const ws = [...inp.weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const wBase = inp.startWeight ?? (ws[0] ? ws[0].kg : null);
  let wCur = ws.length ? ws[ws.length - 1].kg : wBase, best = null;
  for (const w of ws) { const a = ma7(ws, w.date); if (a != null && (best == null || a > best)) best = a; }
  if (best != null) wCur = best;
  out.push({ key: 'weight', baseline: wBase, current: wCur, target: t.weight });
  const done = inp.sessions.filter((s) => s.status === 'COMPLETED' && s.dayType !== 'FULL').sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const key of ['squat', 'bench', 'row', 'press']) {
    const variant = (inp.variants && inp.variants[key]) || '';
    let baseline = null, current = null;
    for (const s of done) for (const e of s.exercises) {
      if (e.ex !== EX[key] || (e.variant || '') !== variant || !e.logged.length || e.logged[0].load == null) continue;
      const load = e.logged[0].load;
      if (baseline == null) baseline = load;
      if (allHit(e) && (current == null || load > current)) current = load;
    }
    out.push({ key, baseline, current: current == null ? baseline : Math.max(current, baseline), target: t[key] });
  }
  for (const l of out) l.p = l.baseline == null || l.target === l.baseline ? 0 : Math.min(1, Math.max(0, (l.current - l.baseline) / (l.target - l.baseline)));
  const score = Math.round(out.reduce((a, l) => a + l.p, 0) / out.length * 100);
  return { lines: out, score, stage: stageOf(score) };
}

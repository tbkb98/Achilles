// Hero stage from real numbers (development instructions §5.6).
export const STAGES = ['MORTAL', 'RECRUIT', 'HOPLITE', 'CHAMPION', 'DEMIGOD', 'ACHILLES'];
export function standards(goalKg) { return { weight: goalKg, squat: 1.5 * goalKg, bench: 1.25 * goalKg, row: 1.25 * goalKg, press: 0.75 * goalKg }; }
export function forgeScore(lines) { // lines: [{ baseline, current, target }]
  const ps = lines.map((l) => (l.target === l.baseline ? 0 : Math.min(1, Math.max(0, (l.current - l.baseline) / (l.target - l.baseline)))));
  return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length * 100);
}
export function stageOf(score) { return score >= 100 ? 6 : Math.floor(score / 20) + 1; }

// Eating totals and body-weight trend (brief §12.5). Pure functions.
export function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// 7-day average ending on `date`; needs at least four weigh-ins in the window.
export function ma7(weights, date) {
  const from = addDays(date, -6), xs = weights.filter((w) => w.date >= from && w.date <= date);
  return xs.length >= 4 ? xs.reduce((a, w) => a + w.kg, 0) / xs.length : null;
}
export function weeklyRate(weights, date) {
  const a = ma7(weights, date), b = ma7(weights, addDays(date, -7));
  return a != null && b != null ? a - b : null;
}
export function inWindow(weights, date) { const from = addDays(date, -6); return weights.filter((w) => w.date >= from && w.date <= date).length; }

// day: { slots: [{ kcal, protein, mult, status }], extras: [{ kcal, protein }], milkMl }
export function dayTotals(day) {
  let kcal = 0, protein = 0, partial = false, eaten = 0;
  for (const s of day.slots || []) {
    if (s.status === 'SKIPPED') continue;
    kcal += s.kcal * s.mult; eaten++;
    if (s.protein != null) protein += s.protein * s.mult; else partial = true;
  }
  for (const x of day.extras || []) { kcal += x.kcal; if (x.protein != null) protein += x.protein; else partial = true; }
  return { kcal: Math.round(kcal), protein: Math.round(protein), partial, eaten };
}

// Calorie suggestion from the weight trend (brief §12.5). planFrom: date the current plan started.
// Returns null (not enough data), { kind: 'early' }, { kind: 'ontrack', rate } or { kind: 'change', delta, rate }.
export function calorieSuggestion(weights, date, planFrom) {
  const r1 = weeklyRate(weights, date), r0 = weeklyRate(weights, addDays(date, -7));
  if (r1 == null) return null;
  const age = planFrom ? Math.round((new Date(date + 'T00:00:00Z') - new Date(planFrom + 'T00:00:00Z')) / 86400000) : 999;
  if (age < 14) return { kind: 'early', rate: r1 };
  if (r0 == null) return { kind: 'ontrack', rate: r1 };
  if (r1 < 0.5 && r0 < 0.5) return { kind: 'change', delta: 300, rate: r1 };
  if (r1 > 1 && r0 > 1) return { kind: 'change', delta: -300, rate: r1 };
  return { kind: 'ontrack', rate: r1 };
}

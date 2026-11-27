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

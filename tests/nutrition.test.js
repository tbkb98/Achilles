import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, ma7, weeklyRate, dayTotals } from '../js/engine/nutrition.js';

const w = (date, kg) => ({ date, kg });
test('addDays crosses months and years', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});
test('7-day average needs four weigh-ins in the window', () => {
  const xs = [w('2026-01-05', 70), w('2026-01-06', 71), w('2026-01-08', 72)];
  assert.equal(ma7(xs, '2026-01-08'), null);
  xs.push(w('2026-01-09', 71));
  assert.equal(ma7(xs, '2026-01-09'), 71);
  assert.equal(ma7(xs, '2026-01-12'), null); // the 5th has dropped out of the window
});
test('weekly rate compares this week with the week before', () => {
  const xs = [];
  for (let i = 0; i < 14; i++) xs.push(w(addDays('2026-01-01', i), 70 + i * 0.1));
  assert.ok(Math.abs(weeklyRate(xs, '2026-01-14') - 0.7) < 1e-9);
  assert.equal(weeklyRate(xs.slice(7), '2026-01-14'), null);
});
test('day totals: portions, skipped meals, extras, partial protein', () => {
  const t = dayTotals({ slots: [
    { kcal: 1200, protein: 50, mult: 1, status: 'AS_PLANNED' },
    { kcal: 300, protein: null, mult: 1.5, status: 'ADJUSTED' },
    { kcal: 0, protein: null, mult: 1, status: 'SKIPPED' },
  ], extras: [{ kcal: 250, protein: 20 }] });
  assert.deepEqual(t, { kcal: 1900, protein: 70, partial: true, eaten: 2 });
  assert.deepEqual(dayTotals({}), { kcal: 0, protein: 0, partial: false, eaten: 0 });
});

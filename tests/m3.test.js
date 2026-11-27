import test from 'node:test';
import assert from 'node:assert/strict';
import { forgeLines } from '../js/engine/forge.js';
import { recoveryLight, squatStalled, median } from '../js/engine/recovery.js';
import { calorieSuggestion, addDays } from '../js/engine/nutrition.js';

const ses = (date, dayType, rows) => ({ date, dayType, status: 'COMPLETED', exercises: rows.map(([ex, variant, sets, reps, load, got]) => ({ ex, variant, sets, reps, logged: (got || Array(sets).fill(reps)).map((r) => ({ reps: r, load })) })) });

test('forge lines: baseline is the first load, current the best fully completed one', () => {
  const sessions = [
    ses('2024-05-01', 'FULL', [['squat', '', 1, 20, 90]]),                       // old sheet: ignored
    ses('2026-01-10', 'UPPER', [['bench', 'Fat Gripz', 3, 12, 50], ['row', '', 2, 15, 40], ['ohp', 'Fat Gripz', 3, 10, 30]]),
    ses('2026-01-11', 'LOWER', [['squat', '', 1, 20, 40]]),
    ses('2026-01-13', 'LOWER', [['squat', '', 1, 20, 60]]),
    ses('2026-01-15', 'LOWER', [['squat', '', 1, 20, 62.5, [17]]]),              // missed reps: does not count
    ses('2026-01-16', 'UPPER', [['bench', '', 3, 12, 55], ['row', '', 2, 15, 55], ['ohp', 'Fat Gripz', 3, 10, 37.5]]),
  ];
  const f = forgeLines({ sessions, weights: [{ date: '2026-01-10', kg: 71 }], startWeight: 70, goalWeight: 80, variants: { bench: '', press: 'Fat Gripz' } });
  const by = Object.fromEntries(f.lines.map((l) => [l.key, l]));
  assert.deepEqual([by.squat.baseline, by.squat.current, by.squat.target], [40, 60, 120]);
  assert.deepEqual([by.bench.baseline, by.bench.current], [55, 55]);              // new variant starts its own line
  assert.deepEqual([by.row.baseline, by.row.current], [40, 55]);
  assert.deepEqual([by.press.baseline, by.press.current, by.press.target], [30, 37.5, 60]);
  assert.deepEqual([by.weight.baseline, by.weight.current], [70, 71]);
  assert.equal(f.score, 17);   // (0.10 + 0.25 + 0 + 0.25 + 0.25) / 5
  assert.equal(f.stage, 1);
});

test('forge without a goal weight, and with nothing logged', () => {
  assert.equal(forgeLines({ sessions: [], weights: [], goalWeight: null }), null);
  const f = forgeLines({ sessions: [], weights: [], startWeight: 70, goalWeight: 80, variants: {} });
  assert.equal(f.score, 0); assert.equal(f.stage, 1);
});

test('recovery light', () => {
  assert.equal(median([60, 58, 62, 61, 59]), 60);
  assert.equal(recoveryLight({ sleep: 8, pulse: 60, ache: false }, [60, 58, 62, 61, 59], false).light, 'GREEN');
  assert.equal(recoveryLight({ sleep: 6.5, pulse: null, ache: false }, [], false).light, 'AMBER');
  assert.equal(recoveryLight({ sleep: 8, pulse: 66, ache: false }, [60, 58, 62, 61, 59], false).light, 'AMBER');
  assert.equal(recoveryLight({ sleep: 8, pulse: 69, ache: false }, [60, 58, 62, 61, 59], false).light, 'RED');
  assert.equal(recoveryLight({ sleep: 8, pulse: 69, ache: false }, [60, 58], false).light, 'GREEN'); // too few mornings to judge
  assert.equal(recoveryLight({ sleep: 9, pulse: null, ache: true }, [], false).light, 'RED');
  assert.deepEqual(recoveryLight({ sleep: 8, pulse: null, ache: false }, [], true), { light: 'AMBER', why: ['squat has not moved in two sessions'] });
  assert.equal(squatStalled([50, 52.5, 52.5, 52.5]), true);
  assert.equal(squatStalled([50, 52.5, 55]), false);
  assert.equal(squatStalled([52.5, 52.5]), false);
});

test('calorie suggestion follows two weeks of trend, and waits out a new plan', () => {
  const run = (perDay, days = 21) => Array.from({ length: days }, (_, i) => ({ date: addDays('2026-01-01', i), kg: 70 + i * perDay }));
  const end = '2026-01-21';
  assert.deepEqual(calorieSuggestion(run(0.03), end, '2025-12-01').delta, 300);     // +0.21 kg a week
  assert.deepEqual(calorieSuggestion(run(0.2), end, '2025-12-01').delta, -300);     // +1.4 kg a week
  assert.equal(calorieSuggestion(run(0.1), end, '2025-12-01').kind, 'ontrack');     // +0.7 kg a week
  assert.equal(calorieSuggestion(run(0.03), end, '2026-01-12').kind, 'early');
  assert.equal(calorieSuggestion(run(0.03, 3), '2026-01-03', '2025-12-01'), null);
});

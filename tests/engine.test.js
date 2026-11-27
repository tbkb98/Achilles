import test from 'node:test';
import assert from 'node:assert/strict';
import { RULE, roundDown, layoffFactor, nextTarget, layoffLoad, buildSession, historyFor } from '../js/engine/progression.js';
import { plates } from '../js/engine/plates.js';
import { nextDayType } from '../js/engine/schedule.js';
import { forgeScore, stageOf, standards } from '../js/engine/forge.js';
import { EXERCISES, TEMPLATES, PROTOCOLS } from '../seed/program.js';

const sq = (load, reps) => ({ date: '2026-11-17', load, reps: [reps], prescribedSets: 1, prescribedReps: 20 });
const dp = (load, reps) => ({ date: '2026-11-14', load, reps, prescribedSets: 3, prescribedReps: 12 });

test('brief §12.1 table', () => {
  assert.equal(nextTarget(RULE.SQUAT, [sq(50, 20)], 2.5).load, 52.5);
  assert.equal(nextTarget(RULE.SQUAT, [sq(52.5, 17)], 2.5).load, 52.5);
  assert.equal(nextTarget(RULE.SQUAT, [sq(52.5, 17), sq(52.5, 18)], 2.5).load, 45);
  assert.equal(nextTarget(RULE.DOUBLE, [dp(52.5, [12, 12, 12])], 2.5).load, 55);
  assert.equal(nextTarget(RULE.DOUBLE, [dp(52.5, [12, 12, 10])], 2.5).load, 52.5);
  assert.equal(nextTarget(RULE.DOUBLE, [dp(52.5, [12, 12])], 2.5).load, 52.5); // a set short
  assert.equal(nextTarget(RULE.BW, [{ ...dp(null, [12, 12, 12]), ext: 0 }], 2.5).suggestAdd, true);
  assert.equal(nextTarget(RULE.DOUBLE, [], 2.5).first, true);
  assert.equal(layoffLoad(80, layoffFactor(20), 2.5), 70);
  assert.equal(nextTarget(RULE.PROTO, [{ load: 30, reps: [15, 20, 25, 20, 15], stagesDone: 5, stagesTotal: 5 }], 2.5).load, 32.5);
  assert.equal(nextTarget(RULE.PROTO, [{ load: 30, reps: [15, 20, 25], stagesDone: 3, stagesTotal: 5 }], 2.5).load, 30);
});

test('layoff bands and rounding', () => {
  assert.deepEqual([0, 13, 14, 27, 28, 55, 56, 400].map(layoffFactor), [1, 1, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7]);
  assert.equal(roundDown(47.25, 2.5), 45);
  assert.equal(roundDown(78.75, 2.5), 77.5);
  assert.equal(roundDown(55, 2.5), 55);
  assert.equal(roundDown(15.9, 2), 14);
});

test('plates', () => {
  const inv = [25, 20, 10, 5, 2.5, 1.25];
  assert.deepEqual(plates(52.5, 20, inv).plates, [10, 5, 1.25]);
  assert.deepEqual(plates(100, 20, inv).plates, [25, 10, 5]);
  assert.deepEqual(plates(52.5, 20, [...inv, 15]).plates, [15, 1.25]);
  assert.deepEqual(plates(20, 20, inv).plates, []);
  assert.equal(plates(15, 20, inv), null);
  assert.equal(plates(52.5, 20, [10, 5, 2.5]).leftover, 1.25);
});

test('schedule alternates on the last completed session', () => {
  const s = (date, dayType, status = 'COMPLETED') => ({ date, dayType, status });
  assert.equal(nextDayType([]), 'UPPER');
  assert.equal(nextDayType([s('2026-11-14', 'UPPER'), s('2026-11-17', 'LOWER')]), 'UPPER');
  assert.equal(nextDayType([s('2026-11-14', 'UPPER'), s('2026-11-17', 'LOWER'), s('2026-11-20', 'UPPER', 'ABANDONED')]), 'UPPER');
  assert.equal(nextDayType([s('2026-11-17', 'LOWER'), s('2026-11-28', 'UPPER')]), 'LOWER');
});

test('forge score: mean progress on five lines, clamped, mapped to six stages', () => {
  const t = standards(80), base = { weight: 70, squat: 40, bench: 40, row: 40, press: 30 };
  assert.deepEqual(t, { weight: 80, squat: 120, bench: 100, row: 100, press: 60 });
  const f = (cur) => forgeScore(Object.keys(base).map((k) => ({ baseline: base[k], current: cur[k], target: t[k] })));
  assert.equal(f(base), 0); assert.equal(stageOf(0), 1);
  const fifth = f({ weight: 72, squat: 56, bench: 52, row: 52, press: 36 });
  assert.equal(fifth, 20); assert.equal(stageOf(fifth), 2); assert.equal(stageOf(19), 1);
  const most = f({ weight: 80, squat: 90, bench: 70, row: 70, press: 45 });
  assert.equal(most, 63); assert.equal(stageOf(most), 4);
  assert.equal(stageOf(f(t)), 6); assert.equal(stageOf(99), 5);
  assert.equal(f({ ...base, squat: 30 }), 0);          // never negative
  assert.equal(f({ ...t, squat: 200 }), 100);           // never above 100
});

// Session building against two earlier sessions (an upper day as first logged, then a lower day).
const done = (date, dayType, rows) => ({
  date, dayType, status: 'COMPLETED',
  exercises: rows.map(([ex, variant, sets, reps, load, ext, got]) => ({ ex, variant, sets, reps, skipped: false, logged: (got || Array(sets).fill(reps)).map((r) => ({ reps: r, load, ext: ext || 0 })) })),
});
const past = [
  done('2026-01-10', 'UPPER', [['ohp', 'Fat Gripz', 3, 10, 30], ['bench', 'Fat Gripz', 3, 12, 50], ['row', '', 2, 15, 40], ['pullup', '', 3, 12, null, 0, [9]], ['inclinedb', '', 3, 12, 10], ['curl', 'Fat Gripz', 3, 12, 30], ['skull', '', 3, 12, 20], ['wristcurl', '', 3, 20, 20]]),
  done('2026-01-13', 'LOWER', [['squat', '', 1, 20, 60], ['sldl', '', 1, 15, 60], ['hipthrust', '', 3, 20, 60], ['legext', '', 5, 0, 40, 0, [15, 20, 25, 20, 15]], ['toeraise', '', 3, 20, 45], ['situp', '', 3, 20, null, 5]]),
];
const tpl = (id) => TEMPLATES.find((t) => t.id === id);
const byEx = (s) => Object.fromEntries(s.exercises.map((e) => [e.ex, e]));

test('lower day targets ten days later (gym script steps 4 and 6)', () => {
  const s = byEx(buildSession(tpl('lower'), EXERCISES, PROTOCOLS, past, { today: '2026-01-23' }));
  assert.equal(s.squat.target.load, 62.5);
  assert.equal(s.sldl.target.load, 62.5);
  assert.equal(s.hipthrust.target.load, 62.5);
  assert.equal(s.legext.target.load, 42.5);
  assert.equal(s.legext.sets, 5);
  assert.equal(s.situp.target.ext, 5);
  assert.equal(s.situp.suggestAdd, true);
  assert.equal(s.squat.linkedToNext, true);
});

test('revised upper day: a new variant asks for a load, with the other variant as floor', () => {
  const s = byEx(buildSession(tpl('upper-revised'), EXERCISES, PROTOCOLS, past, { today: '2026-01-23' }));
  assert.equal(s.bench.first, true);
  assert.equal(s.bench.target.load, 50);
  assert.equal(s.ohp.target.load, 32.5);
  assert.equal(s.inclinedb.target.load, 12);
  assert.equal(s.row.target.load, 42.5);
  assert.equal(s.lateral.first, true);
  assert.equal(s.pullup.suggestAdd, false);
  assert.equal(s.wristcurl.target.load, 22.5);
});

test('accepted layoff replaces progression with a lighter load', () => {
  const s = byEx(buildSession(tpl('upper-revised'), EXERCISES, PROTOCOLS, past, { today: '2026-01-25', layoff: 0.9 }));
  assert.equal(s.ohp.target.load, 25);       // 30 × 0.9 = 27 → 25
  assert.equal(s.inclinedb.target.load, 8);  // 10 × 0.9 = 9 → 8
  assert.equal(historyFor(past, 'bench', 'Fat Gripz').length, 1);
});

test('history older than eight weeks is treated as a fresh start', () => {
  const s = byEx(buildSession(tpl('lower'), EXERCISES, PROTOCOLS, past, { today: '2026-06-01' }));
  assert.equal(s.squat.first, true);
  assert.equal(s.squat.target.load, 40);     // 60 × 0.7 = 42 → 40
});

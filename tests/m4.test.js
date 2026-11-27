import test from 'node:test';
import assert from 'node:assert/strict';
import { allSetsHit, nextTarget, warmupSets, withAdded, buildSession, RULE } from '../js/engine/progression.js';
import { pendingFor } from '../js/engine/session.js';
import { EXERCISES, TEMPLATES, PROTOCOLS, ADDED } from '../seed/program.js';
import { stretchAfter, stretchDuring, WARMUP } from '../seed/mobility.js';

test('a rep range is earned at its top, a plain target at the target', () => {
  const range = (reps) => ({ reps, prescribedSets: 3, prescribedReps: 12, prescribedTop: 15 });
  assert.equal(allSetsHit(range([12, 12, 12])), false);
  assert.equal(allSetsHit(range([15, 15, 14])), false);
  assert.equal(allSetsHit(range([15, 15, 15])), true);
  assert.equal(allSetsHit({ reps: [12, 12, 12], prescribedSets: 3, prescribedReps: 12 }), true);
  const h = (reps) => [{ date: '2026-01-01', load: 40, ...range(reps) }];
  assert.equal(nextTarget(RULE.DOUBLE, h([15, 14, 13]), 2.5).load, 40);
  assert.equal(nextTarget(RULE.DOUBLE, h([15, 15, 16]), 2.5).load, 42.5);
});

test('warm-up sets: empty bar, then about sixty percent', () => {
  assert.deepEqual(warmupSets(52.5, 20, 2.5), [{ load: 20, reps: 10 }, { load: 30, reps: 5 }]);
  assert.deepEqual(warmupSets(100, 20, 2.5), [{ load: 20, reps: 10 }, { load: 60, reps: 5 }]);
  assert.deepEqual(warmupSets(30, 20, 2.5), [{ load: 20, reps: 10 }]);   // sixty percent would be below the bar
  assert.deepEqual(warmupSets(20, 20, 2.5), []);
  assert.deepEqual(warmupSets(null, 20, 2.5), []);
});

test('the new lifts sit where they were asked for', () => {
  const order = (id) => TEMPLATES.find((t) => t.id === id).items.map((x) => x.ex);
  const lower = order('lower'), upper = order('upper-revised');
  assert.equal(upper[upper.indexOf('row') + 1], 'shrug');
  assert.equal(lower[lower.indexOf('legext') + 1], 'legcurl');
  assert.deepEqual(lower.slice(-3), ['neckcurl', 'neckext', 'neckside']);
  for (const t of TEMPLATES) for (const it of t.items) assert.ok(EXERCISES[it.ex], it.ex);
  const s = buildSession(TEMPLATES[0], EXERCISES, PROTOCOLS, [], { today: '2026-11-27' });
  const neck = s.exercises.find((e) => e.ex === 'neckcurl'), curl = s.exercises.find((e) => e.ex === 'legcurl');
  assert.deepEqual([neck.sets, neck.reps, neck.top, neck.target.load], [2, 15, 25, 2.5]);
  assert.deepEqual([curl.sets, curl.reps, curl.top], [3, 12, 15]);
  assert.equal(s.exercises.find((e) => e.ex === 'squat').top, 0);
  const u = buildSession(TEMPLATES[1], EXERCISES, PROTOCOLS, [], { today: '2026-11-27' });
  assert.equal(u.exercises.find((e) => e.ex === 'facepull').optional, true);
});

test('an edited routine receives the new lifts once, in place', () => {
  const edited = [{ ex: 'sldl', sets: 1, reps: 15 }, { ex: 'squat', sets: 1, reps: 20 }, { ex: 'legext', protocol: 'legext5' }, { ex: 'toeraise', sets: 4, reps: 20 }];
  const out = withAdded('lower', edited, TEMPLATES, ADDED.items).map((x) => x.ex);
  assert.deepEqual(out, ['sldl', 'squat', 'legext', 'legcurl', 'toeraise', 'neckcurl', 'neckext', 'neckside']);
  assert.equal(edited.length, 4);                                                    // input untouched
  const again = withAdded('lower', withAdded('lower', edited, TEMPLATES, ADDED.items), TEMPLATES, ADDED.items);
  assert.equal(again.length, 8);
  const noRows = withAdded('upper-revised', [{ ex: 'bench', sets: 3, reps: 12 }], TEMPLATES, ADDED.items).map((x) => x.ex);
  assert.deepEqual(noRows, ['bench', 'shrug', 'facepull']);                          // no anchor: at the end
  assert.deepEqual(withAdded('mine', edited, TEMPLATES, ADDED.items), edited);
});

test('in a rep range a set starts from what was done, inside the range', () => {
  const e = { reps: 12, top: 15, logged: [], target: { load: 40, ext: 0 }, last: { load: 40, reps: [14, 13, 12] } };
  assert.equal(pendingFor(e).reps, 14);
  e.logged.push({ reps: 13, load: 40, ext: 0 });
  assert.equal(pendingFor(e).reps, 13);
  assert.equal(pendingFor({ reps: 12, top: 15, logged: [], target: { load: 42.5, ext: 0 }, last: { load: 40, reps: [15, 15, 15] } }).reps, 12);   // new weight: bottom of the range
  assert.equal(pendingFor({ reps: 12, top: 15, logged: [], target: { load: 40, ext: 0 }, last: { load: 40, reps: [9] } }).reps, 12);
  assert.equal(pendingFor({ reps: 12, top: 0, logged: [{ reps: 9, load: 40, ext: 0 }], target: { load: 40, ext: 0 }, last: null }).reps, 12);      // plain target unchanged
});

test('stretch prompts follow the lift just finished', () => {
  assert.equal(stretchAfter('bench', 'UPPER'), 'Doorway chest stretch');
  assert.equal(stretchAfter('row', 'UPPER'), 'Overhead reach');
  assert.equal(stretchAfter('chestpull', 'LOWER'), 'Hip flexor stretch');             // the squat hands over to chest pulls without a timer
  assert.equal(stretchAfter('chestpull', 'UPPER'), null);
  assert.equal(stretchAfter('situp', 'LOWER'), null);
  assert.equal(stretchDuring('toeraise'), 'Calf stretch');
  assert.equal(stretchDuring('bench'), null);
  assert.equal(WARMUP.UPPER.length, 6); assert.equal(WARMUP.LOWER.length, 6);
});

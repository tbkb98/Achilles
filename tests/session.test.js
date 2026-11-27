import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSession, setsPlanned, setsLogged, nextTarget, historyFor, RULE } from '../js/engine/progression.js';
import { cur, logSet, undo, skip, doLater, endNow, adjustTimer, pendingFor } from '../js/engine/session.js';
import { EXERCISES, TEMPLATES, PROTOCOLS } from '../seed/program.js';

const lower = TEMPLATES.find((t) => t.id === 'lower');
const fresh = () => buildSession(lower, EXERCISES, PROTOCOLS, [], { today: '2026-11-27', now: 0, id: 's1' });

test('gym script: lower day runs start to finish', () => {
  const s = fresh(); let t = 1000;
  assert.equal(setsPlanned(s), 29);
  assert.equal(cur(s).ex, 'squat');
  logSet(s, { reps: 20, load: 52.5, durationSec: 180 }, t);
  assert.equal(cur(s).ex, 'chestpull'); assert.equal(s.timer, null);          // linked: no rest
  logSet(s, { reps: 20 }, t += 1000); assert.equal(s.timer.kind, 'rest'); assert.equal(s.timer.total, 60);
  logSet(s, { reps: 20 }, t += 1000); assert.equal(cur(s).ex, 'sldl'); assert.equal(s.timer.kind, 'transition'); assert.equal(s.timer.total, 90);
  logSet(s, { reps: 13, load: 52.5 }, t += 1000); assert.equal(cur(s).ex, 'hipthrust'); assert.equal(s.timer.total, 180);
  for (let i = 0; i < 3; i++) logSet(s, { reps: 20, load: 52.5 }, t += 1000);
  assert.equal(cur(s).ex, 'legext');
  assert.equal(pendingFor(cur(s)).reps, 15);
  for (const st of PROTOCOLS.legext5) { assert.equal(pendingFor(cur(s)).reps, st.reps); logSet(s, { reps: st.reps, load: 30, holdSec: st.hold === 'max' ? 34 : st.hold }, t += 1000); }
  assert.equal(cur(s).ex, 'legcurl'); assert.equal(pendingFor(cur(s)).reps, 12);
  for (let i = 0; i < 3; i++) logSet(s, { reps: 13, load: 30 }, t += 1000);
  assert.equal(cur(s).ex, 'toeraise');
  for (let i = 0; i < 3; i++) logSet(s, { reps: 20, load: 47.5 }, t += 1000);
  for (let i = 0; i < 3; i++) logSet(s, { reps: 20, ext: 5 }, t += 1000);
  logSet(s, { reps: 20 }, t += 1000); assert.equal(s.status, 'ACTIVE');
  logSet(s, { reps: 20 }, t += 1000);
  for (const ex of ['neckcurl', 'neckext', 'neckside']) { assert.equal(cur(s).ex, ex); assert.equal(s.status, 'ACTIVE'); for (let i = 0; i < 2; i++) logSet(s, { reps: 15, load: 2.5 }, t += 1000); }
  assert.equal(s.status, 'COMPLETED'); assert.equal(setsLogged(s), 29); assert.equal(s.timer, null);
  assert.equal(nextTarget(RULE.DOUBLE, historyFor([s], 'legcurl', ''), 2.5).load, 30);          // 13s in a 12–15 range: same weight
  // step 8: 13 reps instead of 15 keeps the deadlift at 52.5 next time
  assert.equal(nextTarget(RULE.DOUBLE, historyFor([s], 'sldl', ''), 2.5).load, 52.5);
  assert.equal(nextTarget(RULE.SQUAT, historyFor([s], 'squat', ''), 2.5).load, 55);
  assert.equal(s.exercises.find((e) => e.ex === 'legext').logged[4].holdSec, 34);
  // undo re-opens the session
  assert.equal(undo(s), true); assert.equal(s.status, 'ACTIVE'); assert.equal(cur(s).ex, 'neckside'); assert.equal(setsLogged(s), 28);
});

test('undo walks back across a linked exercise', () => {
  const s = fresh();
  logSet(s, { reps: 20, load: 52.5 }, 1000);
  assert.equal(cur(s).ex, 'chestpull');
  undo(s);
  assert.equal(cur(s).ex, 'squat'); assert.equal(setsLogged(s), 0);
  assert.equal(undo(s), false);
});

test('skip, do later, end now, timer adjust', () => {
  const s = fresh();
  doLater(s); assert.equal(cur(s).ex, 'chestpull'); assert.equal(s.exercises.at(-1).ex, 'squat');
  skip(s, 5); assert.equal(cur(s).ex, 'sldl');
  logSet(s, { reps: 15, load: 50 }, 1000);
  adjustTimer(s, 15); assert.equal(s.timer.total, 195); assert.equal(s.timer.endsAt, 1000 + 195000);
  endNow(s, 9000);
  assert.equal(s.status, 'COMPLETED'); assert.equal(setsLogged(s), 1);
  assert.equal(setsPlanned(s), 1);
});

test('a load changed on set one carries to set two', () => {
  const s = buildSession(TEMPLATES.find((t) => t.id === 'upper-revised'), EXERCISES, PROTOCOLS, [], { today: '2026-11-27', now: 0, id: 'u1' });
  assert.equal(cur(s).first, true);
  logSet(s, { reps: 12, load: 55 }, 1000);
  assert.equal(pendingFor(cur(s)).load, 55);
  assert.equal(s.timer.total, 120);
});

// Session mutators. Pure: they change the session object passed in and nothing else.
import { RULE } from './progression.js';

export const cur = (s) => s.exercises[s.cursor];
const complete = (e) => e.skipped || e.logged.length >= e.sets;

export function mkTimer(kind, sec, now) { return sec > 0 ? { kind, total: sec, startedAt: now, endsAt: now + sec * 1000 } : null; }

// Values a set starts from: what was just lifted in this session, else the target.
export function pendingFor(e) {
  if (e.pending) return e.pending;
  const prev = e.logged[e.logged.length - 1];
  const stage = e.stages ? e.stages[Math.min(e.logged.length, e.stages.length - 1)] : null;
  return { load: prev ? prev.load : e.target.load, ext: prev ? prev.ext : e.target.ext || 0, reps: stage ? stage.reps : e.reps };
}

function finish(s, now) { s.status = 'COMPLETED'; s.endedAt = now; s.timer = null; }

function advance(s, now, withTimer, sec) {
  let i = s.cursor + 1;
  while (i < s.exercises.length && complete(s.exercises[i])) i++;
  if (i >= s.exercises.length) {
    const back = s.exercises.findIndex((e) => !complete(e));
    if (back < 0) return finish(s, now);
    i = back;
  }
  s.cursor = i;
  s.timer = withTimer ? mkTimer('transition', sec, now) : null;
}

export function logSet(s, v, now) {
  const e = cur(s), all = s.exercises.flatMap((x) => x.logged);
  const prevAt = all.length ? Math.max(...all.map((l) => l.at)) : null;
  e.logged.push({ reps: v.reps, load: v.load ?? null, ext: v.ext || 0, holdSec: v.holdSec ?? null, durationSec: v.durationSec ?? null, at: now, restTakenSec: prevAt ? Math.round((now - prevAt) / 1000) : null });
  e.pending = null; e.squat = null; e.hold = null;
  if (e.logged.length < e.sets) {
    const sec = e.stages ? e.stages[e.logged.length - 1].rest : e.rest;
    s.timer = mkTimer('rest', sec, now);
  } else advance(s, now, !e.linkedToNext, e.trans);
}

export function undo(s) {
  let i = s.cursor;
  if (s.status === 'COMPLETED') { s.status = 'ACTIVE'; s.endedAt = null; }
  if (!s.exercises[i].logged.length) {
    let best = -1, at = -1;
    s.exercises.forEach((e, k) => { const l = e.logged[e.logged.length - 1]; if (l && l.at > at) { at = l.at; best = k; } });
    if (best < 0) return false;
    i = best;
  } else {
    // the newest set may live on another exercise (linked or reordered)
    let best = i, at = s.exercises[i].logged.at(-1).at;
    s.exercises.forEach((e, k) => { const l = e.logged[e.logged.length - 1]; if (l && l.at > at) { at = l.at; best = k; } });
    i = best;
  }
  s.exercises[i].logged.pop();
  s.cursor = i; s.timer = null;
  return true;
}

export function skip(s, now) { cur(s).skipped = true; advance(s, now, false, 0); }

export function doLater(s) {
  if (s.exercises.slice(s.cursor + 1).every(complete)) return false;
  const [e] = s.exercises.splice(s.cursor, 1);
  s.exercises.push(e); s.timer = null;
  while (complete(s.exercises[s.cursor])) s.cursor++;
  return true;
}

export function addExercise(s, entry) { s.exercises.splice(s.cursor + 1, 0, entry); }

export function endNow(s, now) { s.exercises.forEach((e) => { if (!complete(e) && !e.logged.length) e.skipped = true; }); finish(s, now); }

export function adjustTimer(s, sec) { if (s.timer) { s.timer.endsAt += sec * 1000; s.timer.total = Math.max(0, s.timer.total + sec); } }

export function isSquat(e) { return e.rule === RULE.SQUAT; }

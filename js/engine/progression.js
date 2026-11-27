// Pure progression rules. No DOM, no storage. Brief §12.1–12.3.
export const RULE = { SQUAT: 'BREATHING_SQUAT', DOUBLE: 'DOUBLE_PROGRESSION', BW: 'BODYWEIGHT_REPS', UNW: 'UNWEIGHTED', PROTO: 'PROTOCOL' };
export const STALE_DAYS = 56;

// Round down to the nearest achievable step (works in thousandths to avoid float drift).
export function roundDown(x, inc) {
  const i = Math.round(inc * 1000);
  return Math.floor(Math.round(x * 1000) / i + 1e-9) * i / 1000;
}

// Brief §12.2: suggested load factor after a break.
export function layoffFactor(days) {
  if (days == null || days <= 13) return 1;
  if (days <= 27) return 0.9;
  if (days <= 55) return 0.8;
  return 0.7;
}

export function daysBetween(aIso, bIso) {
  const a = new Date(aIso.slice(0, 10) + 'T00:00:00Z'), b = new Date(bIso.slice(0, 10) + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export function allSetsHit(e) {
  return e.reps.length >= e.prescribedSets && e.reps.every((r) => r >= (e.prescribedTop || e.prescribedReps));   // a range (12–15) is earned at its top
}

// hist: entries for the SAME exercise and variant, oldest first.
// entry: { date, load, ext, reps:[..], prescribedSets, prescribedReps, stagesDone, stagesTotal }
export function nextTarget(rule, hist, inc) {
  const last = hist[hist.length - 1];
  if (!last) return { first: true, load: null, ext: 0 };
  if (rule === RULE.SQUAT) { // SES-09
    if ((last.reps[0] || 0) >= 20) return { load: last.load + inc };
    let fails = 0;
    for (let i = hist.length - 1; i >= 0 && (hist[i].reps[0] || 0) < 20; i--) fails++;
    return { load: fails >= 2 ? roundDown(last.load * 0.9, inc) : last.load };
  }
  if (rule === RULE.DOUBLE) return { load: allSetsHit(last) ? last.load + inc : last.load };
  if (rule === RULE.PROTO) return { load: last.stagesDone >= last.stagesTotal ? last.load + inc : last.load };
  if (rule === RULE.BW) return { ext: last.ext || 0, suggestAdd: allSetsHit(last) };
  return {};
}

export function layoffLoad(lastLoad, factor, inc) { return roundDown(lastLoad * factor, inc); }

// One or two lighter sets before the first working set of a big barbell lift: the empty bar, then about 60%.
export function warmupSets(load, bar, inc) {
  if (load == null || load <= bar) return [];
  const out = [{ load: bar, reps: 10 }], mid = roundDown(load * 0.6, inc || 2.5);
  if (mid >= bar + 5) out.push({ load: mid, reps: 5 });
  return out;
}

// Put lifts added to a built-in routine into an edited copy of it: after their anchor lift, else at the end.
// added: [[routineId, lift, anchorLift|null]]. Lifts already present are left where they are.
export function withAdded(id, items, seedTemplates, added) {
  const seed = seedTemplates.find((t) => t.id === id), out = items.map((x) => ({ ...x }));
  if (!seed) return out;
  for (const [tid, ex, after] of added) {
    const it = seed.items.find((x) => x.ex === ex);
    if (tid !== id || !it || out.some((x) => x.ex === ex)) continue;
    const i = after ? out.findIndex((x) => x.ex === after) : -1;
    if (i >= 0) out.splice(i + 1, 0, { ...it }); else out.push({ ...it });
  }
  return out;
}

// Pull one exercise's history out of completed sessions.
export function historyFor(sessions, exId, variant) {
  const out = [];
  for (const s of sessions) {
    if (s.status !== 'COMPLETED') continue;
    for (const e of s.exercises) {
      if (e.ex !== exId || (e.variant || '') !== (variant || '') || e.skipped || !e.logged.length) continue;
      out.push({
        date: s.date, load: e.logged[0].load ?? null, ext: e.logged[0].ext || 0,
        reps: e.logged.map((l) => l.reps), prescribedSets: e.sets, prescribedReps: e.reps, prescribedTop: e.top || 0,
        stagesDone: e.logged.length, stagesTotal: e.sets,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Most recent load for this exercise in ANY variant within STALE_DAYS (floor for a new variant).
function recentAnyVariant(sessions, exId, today) {
  let best = null;
  for (const s of sessions) {
    if (s.status !== 'COMPLETED' || daysBetween(s.date, today) > STALE_DAYS) continue;
    for (const e of s.exercises) {
      if (e.ex === exId && e.logged.length && e.logged[0].load != null && (!best || s.date > best.date)) best = { date: s.date, load: e.logged[0].load };
    }
  }
  return best ? best.load : null;
}

// Build today's session from a template. opts: { today, layoff (factor to apply, 1 = none) }
export function buildSession(template, lib, protocols, sessions, opts) {
  const today = opts.today, factor = opts.layoff || 1;
  const exercises = template.items.map((it) => {
    const def = lib[it.ex];
    const stages = it.protocol ? protocols[it.protocol] : null;
    const hist = historyFor(sessions, it.ex, it.variant);
    const last = hist[hist.length - 1];
    const stale = !last || daysBetween(last.date, today) > STALE_DAYS;
    const weighted = def.rule === RULE.SQUAT || def.rule === RULE.DOUBLE || def.rule === RULE.PROTO;
    let t = nextTarget(def.rule, hist, def.inc || 2.5);
    let first = false, last_ = last || null;
    if (weighted) {
      if (stale) {
        first = true;
        const own = last ? layoffLoad(last.load, 0.7, def.inc) : null;
        const other = recentAnyVariant(sessions, it.ex, today);
        const guess = Math.max(own || 0, other || 0) || def.start || null;
        t = { load: guess };
      } else if (factor < 1) t = { load: layoffLoad(last.load, factor, def.inc) };
    }
    return {
      ex: it.ex, variant: it.variant || '', name: def.name, rule: def.rule, equip: def.equip, inc: def.inc || 2.5,
      sets: stages ? stages.length : it.sets, reps: it.reps || 0, top: !stages && it.top > it.reps ? it.top : 0, optional: !!it.optional, stages,
      linkedToNext: !!it.linkedToNext, rest: def.rest, trans: def.trans,
      target: { load: t.load ?? null, ext: t.ext || 0 }, suggestAdd: !!t.suggestAdd, first,
      last: last_ ? { date: last_.date, load: last_.load, ext: last_.ext, reps: last_.reps } : null,
      pending: null, logged: [], skipped: false, note: '',
    };
  });
  return {
    id: opts.id, date: today, startedAt: opts.now, endedAt: null, tz: opts.tz || '', dayType: template.dayType,
    templateId: template.id, status: 'ACTIVE', notes: '', cursor: 0, timer: null, exercises,
  };
}

export function setsPlanned(session) { return session.exercises.filter((e) => !e.skipped).reduce((n, e) => n + e.sets, 0); }
export function setsLogged(session) { return session.exercises.reduce((n, e) => n + e.logged.length, 0); }

// Morning check-in → traffic light (brief §12.6). A suggestion only: it never blocks a session.
export function median(xs) { const a = [...xs].sort((x, y) => x - y), n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; }

// loads: squat loads of completed sessions, oldest first. Stalled = no increase two sessions running.
export function squatStalled(loads) { const n = loads.length; return n >= 3 && loads[n - 1] <= loads[n - 2] && loads[n - 2] <= loads[n - 3]; }

// check: { sleep (hours), pulse (bpm or null), ache (bool) }; pastPulses: earlier mornings, last 14 days.
export function recoveryLight(check, pastPulses, stalled) {
  const why = []; let level = 0;
  const up = (l, text) => { level = Math.max(level, l); why.push(text); };
  if (check.ache) up(2, 'deep muscle ache');
  if (check.sleep != null && check.sleep < 5) up(2, `${check.sleep} h of sleep`);
  else if (check.sleep != null && check.sleep < 7) up(1, `${check.sleep} h of sleep`);
  if (check.pulse && pastPulses.length >= 5) {
    const d = Math.round(check.pulse - median(pastPulses));
    if (d >= 8) up(2, `pulse ${d} above your usual`); else if (d >= 5) up(1, `pulse ${d} above your usual`);
  }
  if (stalled) up(1, 'squat has not moved in two sessions');
  return { light: ['GREEN', 'AMBER', 'RED'][level], why };
}

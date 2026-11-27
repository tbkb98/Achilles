// Brief §12.7: next day type is the opposite of the last completed Upper/Lower session.
export function lastOfType(sessions, dayType) {
  let best = null;
  for (const s of sessions) if (s.status === 'COMPLETED' && (!dayType || s.dayType === dayType) && (!best || s.date > best.date || (s.date === best.date && (s.startedAt || '') > (best.startedAt || '')))) best = s;
  return best;
}
export function nextDayType(sessions) {
  const ul = sessions.filter((s) => s.dayType === 'UPPER' || s.dayType === 'LOWER');
  const last = lastOfType(ul);
  if (!last) return 'UPPER';
  return last.dayType === 'UPPER' ? 'LOWER' : 'UPPER';
}

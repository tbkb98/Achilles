import { h, kg } from '../dom.js';
import { today } from '../state.js';
import { RULE, daysBetween } from '../engine/progression.js';
import { forgeNow } from '../program.js';

export const scheme = (e) => (e.stages ? `${e.stages.length} stages` : `${e.sets}×${e.reps}`);
export function targetText(e) {
  if (e.rule === RULE.UNW) return 'no weight';
  if (e.rule === RULE.BW) return e.target.ext ? `BW + ${kg(e.target.ext)} kg` : 'bodyweight';
  if (e.target.load == null) return 'set your load';
  return `${kg(e.target.load)} kg`;
}
export function lastText(e) {
  const l = e.last; if (!l) return null;
  const reps = e.stages ? (l.reps.length >= e.sets ? 'all stages' : `${l.reps.length} of ${e.sets} stages`) : l.reps.join(', ');
  // an old entry says when it was, so a 2025 number is not read as last week's
  const when = l.date && daysBetween(l.date, today()) > 30 ? ` (${new Date(l.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })})` : '';
  if (e.rule === RULE.UNW) return `${reps} reps${when}`;
  if (e.rule === RULE.BW) return `${l.ext ? 'BW + ' + kg(l.ext) + ' kg' : 'BW'} × ${reps}${when}`;
  return `${kg(l.load)} kg ${e.stages ? '· ' : '× '}${reps}${when}`;
}
export function shortVal(e, v) {
  if (e.rule === RULE.UNW) return `${v.reps} REPS`;
  if (e.rule === RULE.BW) return `BW${v.ext ? ' + ' + kg(v.ext) : ''} × ${v.reps}`;
  return `${kg(v.load)} × ${v.reps}`;
}
export const stage = () => { const f = forgeNow(); return f ? f.stage : 1; };
export const heroSrc = (st, flex) => `assets/sprites/hero${Math.min(6, Math.max(1, st))}${flex ? 'b' : ''}.png`;
export const hero = (st, size, cls, flex) => h('img', { class: 'px ' + (cls || ''), src: heroSrc(st, flex), width: size, height: size, alt: 'Your hero' });
export const nameWithVariant = (e) => [e.name, e.variant ? h('span', { class: 'chip', style: 'margin-left:8px' }, e.variant.toUpperCase()) : null];

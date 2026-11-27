import { h, kg } from '../dom.js';
import { S } from '../state.js';
import { RULE } from '../engine/progression.js';

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
  if (e.rule === RULE.UNW) return `${reps} reps`;
  if (e.rule === RULE.BW) return `${l.ext ? 'BW + ' + kg(l.ext) + ' kg' : 'BW'} × ${reps}`;
  return `${kg(l.load)} kg ${e.stages ? '· ' : '× '}${reps}`;
}
export function shortVal(e, v) {
  if (e.rule === RULE.UNW) return `${v.reps} REPS`;
  if (e.rule === RULE.BW) return `BW${v.ext ? ' + ' + kg(v.ext) : ''} × ${v.reps}`;
  return `${kg(v.load)} × ${v.reps}`;
}
export const stage = () => S.kv.stage || 1;
export const hero = (st, size, cls) => h('img', { class: 'px ' + (cls || ''), src: `assets/sprites/hero${Math.min(6, Math.max(1, st))}.png`, width: size, height: size, alt: 'Your hero' });
export const nameWithVariant = (e) => [e.name, e.variant ? h('span', { class: 'chip', style: 'margin-left:8px' }, e.variant.toUpperCase()) : null];

// The program as T has it now: seed templates with his edits on top, visible pillars, and the hero score.
import { TEMPLATES, PILLARS } from '../seed/program.js';
import { S, settings } from './state.js';
import { forgeLines } from './engine/forge.js';

export const templates = () => TEMPLATES.map((t) => (S.kv.templates && S.kv.templates[t.id] ? { ...t, items: S.kv.templates[t.id] } : t));
export const templateById = (id) => templates().find((t) => t.id === id);
export function templateFor(type) {
  const all = templates();
  if (type === 'LOWER') return all.find((t) => t.id === 'lower');
  return all.find((t) => t.id === settings().upperTemplate && t.dayType === 'UPPER') || all.find((t) => t.dayType === 'UPPER');
}

export function allPillars() {
  const hidden = (S.kv.pillarState && S.kv.pillarState.hidden) || [];
  return [...PILLARS.map((text, i) => ({ id: 'seed' + i, text, seed: true })), ...(S.kv.pillars || [])].map((p) => ({ ...p, hidden: hidden.includes(p.id) }));
}
export function visiblePillars() { const v = allPillars().filter((p) => !p.hidden); return v.length ? v : allPillars(); }

export function forgeNow() {
  const g = S.kv.goals;
  if (!g || !g.goalWeight) return null;
  const up = templateFor('UPPER'), variantOf = (ex) => { const it = up.items.find((x) => x.ex === ex); return it ? it.variant || '' : ''; };
  return forgeLines({ sessions: S.sessions, weights: S.weights, startWeight: S.kv.startWeight, goalWeight: g.goalWeight, variants: { bench: variantOf('bench'), press: variantOf('ohp') } });
}

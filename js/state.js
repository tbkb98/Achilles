// In-memory copy of the database plus save helpers. Every change is written at once.
import * as db from './store/db.js';

export const S = { sessions: [], weights: [], recovery: [], days: [], kv: {}, ready: false };
export const DEFAULTS = {
  bar: 20, plates: [25, 20, 10, 5, 2.5, 1.25], bell: true, loud: true, flash: true, tick: true,
  safety: true, pillars: true, upperTemplate: 'upper-revised', sauna: 15, hammam: 15, bellTone: 'ring',
};

export async function load() {
  const [sessions, weights, recovery, kv, days] = await Promise.all(db.STORES.map((s) => db.all(s)));
  S.sessions = sessions; S.weights = weights; S.recovery = recovery; S.days = days;
  S.kv = Object.fromEntries(kv.map((r) => [r.id, r.value]));
  recoverMirror();
  S.ready = true;
}
export const settings = () => ({ ...DEFAULTS, ...(S.kv.settings || {}) });
export function setSetting(k, v) { return setKV('settings', { ...(S.kv.settings || {}), [k]: v }); }
export function setKV(id, value) { S.kv[id] = value; return db.put('kv', { id, value }); }

function upsert(list, obj) { const i = list.findIndex((x) => x.id === obj.id); if (i < 0) list.push(obj); else list[i] = obj; }
// The running session is also mirrored to localStorage, which writes synchronously: if the app is
// killed a moment after a tap, before IndexedDB commits, the newest copy still survives (SES-16).
const MIRROR = 'achilles.active';
const mirror = (s) => { try { if (s) localStorage.setItem(MIRROR, JSON.stringify(s)); else localStorage.removeItem(MIRROR); } catch (e) {} };
export function saveSession(s) {
  s.rev = (s.rev || 0) + 1; upsert(S.sessions, s);
  if (s.status === 'ACTIVE' || s.id === S.kv.activeSessionId) mirror(s);
  return db.put('sessions', s);
}
export function deleteSession(id) { S.sessions = S.sessions.filter((s) => s.id !== id); mirror(null); return db.del('sessions', id); }
export function closeSession() { mirror(null); return setKV('activeSessionId', null); }
function recoverMirror() {
  let m = null; try { m = JSON.parse(localStorage.getItem(MIRROR) || 'null'); } catch (e) {}
  if (!m || !m.id) return;
  const have = S.sessions.find((x) => x.id === m.id);
  if (!have || (have.rev || 0) < (m.rev || 0)) { upsert(S.sessions, m); db.put('sessions', m); }
  if (m.status === 'ACTIVE' && S.kv.activeSessionId !== m.id) setKV('activeSessionId', m.id);
}
export function saveWeight(w) { upsert(S.weights, w); return db.put('bodyweights', w); }
export function saveRecovery(r) { upsert(S.recovery, r); return db.put('recovery', r); }
export function deleteRecovery(id) { S.recovery = S.recovery.filter((r) => r.id !== id); return db.del('recovery', id); }
export function deleteWeight(id) { S.weights = S.weights.filter((w) => w.id !== id); return db.del('bodyweights', id); }
export function saveDay(d) { upsert(S.days, d); return db.put('days', d); }

export const activeSession = () => S.sessions.find((s) => s.id === S.kv.activeSessionId) || null;
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
export function today(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// ---- backup, restore, setup import (development instructions §7) ----
export function exportAll() {
  return { app: 'achilles', schema: 1, exportedAt: new Date().toISOString(), sessions: S.sessions, bodyweights: S.weights, recovery: S.recovery, days: S.days, kv: S.kv };
}
export function validate(data) {
  if (!data || data.app !== 'achilles') return 'This is not an Achilles file.';
  if (data.schema !== 1) return 'This file comes from a newer version of Achilles.';
  for (const k of ['sessions', 'bodyweights', 'recovery', 'days']) if (data[k] && !Array.isArray(data[k])) return 'The file is damaged.';
  return null;
}
// mode 'merge' adds what is missing (setup file); 'replace' wipes first (restore).
export async function importData(data, mode) {
  const err = validate(data); if (err) throw new Error(err);
  if (mode === 'replace') { mirror(null); await Promise.all(db.STORES.map((s) => db.clear(s))); S.sessions = []; S.weights = []; S.recovery = []; S.days = []; S.kv = {}; }
  let added = 0;
  const merge = async (list, store, incoming) => { for (const o of incoming || []) if (!list.some((x) => x.id === o.id)) { list.push(o); await db.put(store, o); added++; } };
  await merge(S.sessions, 'sessions', data.sessions);
  await merge(S.weights, 'bodyweights', data.bodyweights);
  await merge(S.recovery, 'recovery', data.recovery);
  await merge(S.days, 'days', data.days);
  for (const [k, v] of Object.entries(data.kv || {})) {
    if (k === 'activeSessionId' && mode !== 'replace') continue;
    if (mode === 'replace' || S.kv[k] === undefined) await setKV(k, v);
    else if (k === 'settings') await setKV(k, { ...v, ...S.kv.settings });
  }
  return added;
}
export async function eraseAll() { mirror(null); await Promise.all(db.STORES.map((s) => db.clear(s))); S.sessions = []; S.weights = []; S.recovery = []; S.days = []; S.kv = {}; }

export function toCSV() {
  const rows = [['date', 'dayType', 'exercise', 'variant', 'setIndex', 'reps', 'loadKg', 'externalLoadKg', 'holdSec', 'note']];
  const q = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  for (const s of [...S.sessions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (s.status !== 'COMPLETED') continue;
    for (const e of s.exercises) e.logged.forEach((l, i) => rows.push([s.date, s.dayType, e.name, e.variant, i + 1, l.reps, l.load, l.ext || '', l.holdSec, i === 0 ? e.note : '']));
  }
  return rows.map((r) => r.map(q).join(',')).join('\n');
}

// Wide CSV in the layout of T's own sheet: one row per session, then per exercise Sets / Reps / kg (DAT-02).
export function toSheetCSV() {
  const done = S.sessions.filter((s) => s.status === 'COMPLETED').sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const cols = [], seen = new Set();
  for (const type of ['UPPER', 'LOWER', 'FULL']) for (const s of done) if (s.dayType === type) for (const e of s.exercises) {
    const key = `${type}|${e.ex}|${e.variant || ''}`;
    if (!e.logged.length || seen.has(key)) continue;
    seen.add(key); cols.push({ key, title: `${e.name}${e.variant ? ' (' + e.variant + ')' : ''} (${e.stages ? 'protocol' : e.sets + 'x' + e.reps})` });
  }
  const q = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const rows = [['DATE', 'DAY TYPE', ...cols.flatMap((c) => [`${c.title} Sets`, 'Reps', 'kg'])]];
  for (const s of done) {
    const row = [s.date, s.dayType === 'UPPER' ? 'Upper Body' : s.dayType === 'LOWER' ? 'Lower Body' : 'Full Body'];
    for (const c of cols) {
      const e = s.exercises.find((x) => `${s.dayType}|${x.ex}|${x.variant || ''}` === c.key && x.logged.length);
      if (!e) { row.push('', '', ''); continue; }
      const reps = e.logged.map((l) => l.reps), l = e.logged[0];
      const load = l.load != null ? l.load : e.equip === 'bodyweight' ? (l.ext ? `bodyweight+${l.ext}` : 'bodyweight') : 'n/a';
      row.push(e.logged.length, reps.every((r) => r === reps[0]) ? reps[0] : reps.join('/'), load);
    }
    rows.push(row);
  }
  return rows.map((r) => r.map(q).join(',')).join('\n');
}

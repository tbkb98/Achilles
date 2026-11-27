// Minimal IndexedDB wrapper. Everything T logs lives here, on the phone only.
const NAME = 'achilles', VERSION = 2; // v2 adds 'days' (eating log)
export const STORES = ['sessions', 'bodyweights', 'recovery', 'kv', 'days'];
let dbp = null;

function open() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const rq = indexedDB.open(NAME, VERSION);
    rq.onupgradeneeded = () => { for (const s of STORES) if (!rq.result.objectStoreNames.contains(s)) rq.result.createObjectStore(s, { keyPath: 'id' }); };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  return dbp;
}
function tx(store, mode, fn) {
  return open().then((db) => new Promise((res, rej) => {
    const t = db.transaction(store, mode); const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = t.onabort = () => rej(t.error);
  }));
}
export const all = (store) => tx(store, 'readonly', (s) => s.getAll());
export const put = (store, obj) => tx(store, 'readwrite', (s) => s.put(obj));
export const del = (store, id) => tx(store, 'readwrite', (s) => s.delete(id));
export const clear = (store) => tx(store, 'readwrite', (s) => s.clear());

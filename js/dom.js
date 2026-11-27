// Tiny DOM helpers. No framework.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
export const kg = (x) => (x == null ? '' : Number(x).toLocaleString(undefined, { maximumFractionDigits: 2 }));
export const clock = (sec) => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
export const niceDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Stepper: − value + . Updates its own text; hold a button to repeat. No keyboard needed (SES-04).
export function stepper({ value, step, min = 0, max = 9999, fmt, label, onChange }) {
  let v = value, timer = null, rep = null;
  const out = h('div', { class: 'step-val', 'aria-live': 'polite' }, fmt(v));
  const bump = (d) => {
    const n = Math.min(max, Math.max(min, Math.round((v + d * step) * 1000) / 1000));
    if (n === v) return; v = n; out.textContent = fmt(v); onChange(v);
  };
  const stop = () => { clearTimeout(timer); clearInterval(rep); timer = rep = null; };
  const btn = (d, name) => h('button', {
    class: 'step-btn', 'aria-label': `${name} ${label}`,
    onpointerdown: (e) => { e.preventDefault(); bump(d); stop(); timer = setTimeout(() => { rep = setInterval(() => bump(d), 90); }, 450); },
    onpointerup: stop, onpointerleave: stop, onpointercancel: stop,
    onclick: (e) => { if (e.detail === 0) bump(d); }, // keyboard / assistive activation
  }, d < 0 ? '−' : '+');
  return h('div', { class: 'stepper' }, btn(-1, 'Less'), out, btn(1, 'More'));
}

export function bar(pct, cls = '') { return h('div', { class: 'bar ' + cls }, h('div', { style: `width:${Math.max(0, Math.min(100, pct))}%` })); }

// Pixel check mark (the pixel fonts have no such glyph).
export function ok(cls) {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="ok ${cls || ''}" viewBox="0 0 7 6" aria-hidden="true" fill="currentColor" shape-rendering="crispEdges"><path d="M0 3h1v1H0zM1 4h1v1H1zM2 5h1v1H2zM3 4h1v1H3zM4 3h1v1H4zM5 2h1v1H5zM6 1h1v1H6zM1 3h1v1H1zM2 4h1v1H2zM3 3h1v1H3zM4 2h1v1H4zM5 1h1v1H5zM6 0h1v1H6z"/></svg>`;
  return t.content.firstChild;
}

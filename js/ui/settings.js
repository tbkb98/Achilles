// Settings, backup and restore. Everything here stays on the phone.
import { h, kg, stepper } from '../dom.js';
import { S, settings, setSetting, setKV, exportAll, importData, eraseAll, toCSV, toSheetCSV, activeSession, today } from '../state.js';
import { TEMPLATES } from '../../seed/program.js';
import { bell, unlockAudio, shareFile } from '../platform/device.js';
import { render, toast, applyUpdate, VERSION } from '../app.js';

const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];

function toggle(label, key) {
  const on = !!settings()[key];
  return h('button', { class: 'btn' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', style: 'justify-content:space-between', onclick: async () => { await setSetting(key, !on); render(); } }, h('span', {}, label), h('span', { class: 'num', style: 'font-size:10px' }, on ? 'ON' : 'OFF'));
}
function twoTap(label, armedLabel, fn) {
  let armed = false;
  const b = h('button', { class: 'btn', onclick: () => { if (!armed) { armed = true; b.textContent = armedLabel; b.classList.add('on'); setTimeout(() => { armed = false; b.textContent = label; b.classList.remove('on'); }, 4000); return; } fn(); } }, label);
  return b;
}
function pickFile(mode) {
  const inp = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
    try {
      const n = await importData(JSON.parse(await f.text()), mode);
      toast(mode === 'replace' ? 'Backup restored.' : n ? `Imported ${n} records.` : 'Nothing new in that file.');
    } catch (e) { toast(e instanceof SyntaxError ? 'That file is not readable.' : e.message); }
    render();
  });
  document.body.append(inp); inp.click();
}

export function settingsView() {
  const st = settings(), a = activeSession(), busy = a && a.status === 'ACTIVE';
  const own = S.sessions.filter((s) => !s.imported).length;
  return h('div', { class: 'screen tabbed' },
    h('div', { class: 'label' }, 'SETTINGS'),

    h('div', { class: 'panel' }, h('div', { class: 'label gold' }, 'Upper body day'),
      TEMPLATES.filter((t) => t.dayType === 'UPPER').map((t) => h('button', { class: 'btn' + (st.upperTemplate === t.id ? ' on' : ''), 'aria-pressed': st.upperTemplate === t.id ? 'true' : 'false', onclick: async () => { await setSetting('upperTemplate', t.id); render(); } }, t.id === 'upper-revised' ? 'Revised: bench first, lateral raises, pullover' : 'As logged in your sheet')),
      h('div', { class: 'mute small' }, 'Applies from the next session you start.')),

    h('div', { class: 'panel' }, h('div', { class: 'label gold' }, 'Bar and plates'),
      h('div', { class: 'stepper sm' }, h('span', { style: 'width:70px' }, 'Bar'), stepper({ value: st.bar, step: 2.5, min: 5, max: 30, fmt: (x) => `${kg(x)} kg`, label: 'bar weight', onChange: (x) => setSetting('bar', x) })),
      h('div', { class: 'mute small' }, 'Plates your gym has, per side:'),
      h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px' }, PLATES.map((p) => {
        const on = st.plates.includes(p);
        return h('button', { class: 'btn' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', style: 'padding:0', onclick: async () => { await setSetting('plates', on ? st.plates.filter((x) => x !== p) : [...st.plates, p].sort((x, y) => y - x)); render(); } }, kg(p));
      }))),

    h('div', { class: 'panel' }, h('div', { class: 'label gold' }, 'When rest ends'),
      toggle('Bell', 'bell'), toggle('Bell sounds on silent', 'loud'), toggle('Screen flash', 'flash'), toggle('Tick at 10 seconds', 'tick'),
      h('button', { class: 'btn', onclick: () => { unlockAudio(st.loud); bell(); } }, 'Test the bell'),
      h('div', { class: 'mute small' }, 'The bell and flash need Achilles open on screen. A locked phone stays quiet.')),

    h('div', { class: 'panel' }, h('div', { class: 'label gold' }, 'Session'),
      toggle('Ask "Safeties set?" before the squat', 'safety'), toggle('Pillars during rest', 'pillars'),
      h('div', { class: 'stepper sm' }, h('span', { style: 'width:70px' }, 'Sauna'), stepper({ value: st.sauna, step: 1, max: 60, fmt: (x) => `${x} min`, label: 'sauna minutes', onChange: (x) => setSetting('sauna', x) })),
      h('div', { class: 'stepper sm' }, h('span', { style: 'width:70px' }, 'Hammam'), stepper({ value: st.hammam, step: 1, max: 60, fmt: (x) => `${x} min`, label: 'hammam minutes', onChange: (x) => setSetting('hammam', x) }))),

    h('div', { class: 'panel' }, h('div', { class: 'label gold' }, 'Your data'),
      h('div', { class: 'mute small' }, `${own} sessions logged here, ${S.sessions.length - own} from your sheet, ${S.weights.length} weigh-ins, ${S.days.length} days of eating. ` + (S.kv.lastBackupAt ? `Last backup ${S.kv.lastBackupAt.slice(0, 10)}.` : 'No backup yet.')),
      h('button', { class: 'btn on', onclick: async () => { if (await shareFile(`achilles-backup-${today()}.json`, JSON.stringify(exportAll()), 'application/json')) { await setKV('lastBackupAt', new Date().toISOString()); render(); } } }, 'Back up to a file'),
      h('button', { class: 'btn', onclick: () => shareFile(`achilles-sets-${today()}.csv`, toCSV(), 'text/csv') }, 'Export sets as CSV'),
      h('button', { class: 'btn', onclick: () => shareFile(`achilles-sheet-${today()}.csv`, toSheetCSV(), 'text/csv') }, 'Export in my sheet layout'),
      h('button', { class: 'btn', onclick: () => pickFile('merge') }, 'Import a setup or history file'),
      twoTap('Restore from a backup', 'Tap again: this replaces everything', () => pickFile('replace')),
      twoTap('Erase everything on this phone', 'Tap again to erase', async () => { await eraseAll(); toast('Erased.'); render(); }),
      h('div', { class: 'mute small' }, 'Nothing leaves this phone unless you export it. ' + (S.persisted === false ? 'iOS has not marked this storage as permanent, so keep a backup.' : ''))),

    h('div', { class: 'panel' }, h('div', { class: 'label gold' }, 'About'),
      h('div', { class: 'mute small' }, `Achilles ${VERSION}. Sessions, eating, weight trend and recovery. Hero stages and progress charts come next.`),
      S.updateReady && h('button', { class: 'btn on', disabled: busy, onclick: applyUpdate }, busy ? 'Update ready · finish your session first' : 'Update ready · install now'),
      !S.updateReady && h('button', { class: 'btn', onclick: async () => { try { if (S.swReg) await S.swReg.update(); } catch (e) {} setTimeout(() => { toast(S.updateReady ? 'Update found.' : 'You have the latest version.'); render(); }, 1200); } }, 'Check for an update')));
}

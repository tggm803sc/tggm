// The visible Export / Import career controls.
//
// This is its own bundle (career.js) rather than part of game.js: it only needs
// localStorage, so it must work even if the renderer fails, and it keeps the
// large game entry untouched. build.mjs injects the script tag.

import { exportStoredCareer, importStoredCareer } from './career-transfer.js';

const STYLE = {
  wrap: 'margin-top:14px;border-top:1px solid rgba(255,255,255,.12);padding-top:12px',
  label: 'font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8d98a6;margin:0 0 8px',
  row: 'display:flex;gap:10px;flex-wrap:wrap',
  button:
    'flex:1 1 140px;min-height:44px;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);' +
    'background:transparent;color:#eef2f6;font:inherit;font-size:14px;cursor:pointer',
  note: 'margin:8px 0 0;font-size:12px;line-height:1.45;color:#8d98a6',
};

function toast(message) {
  const element = document.getElementById('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 4200);
}

function note(text, tone) {
  if (!noteElement) return;
  noteElement.textContent = text;
  noteElement.style.color = tone === 'error' ? '#ff8a8a' : tone === 'ok' ? '#c7ff00' : '#8d98a6';
}

function exportCareer() {
  const result = exportStoredCareer(safeStorage());
  if (result.status !== 'ok') {
    note('This browser is not allowing storage access, so there is nothing to export.', 'error');
    return;
  }
  try {
    const blob = new Blob([result.text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    note(
      result.empty
        ? `Exported ${result.filename} — it contains no progress yet.`
        : `Exported ${result.filename}.`,
      'ok',
    );
    toast('Career exported');
  } catch {
    note('The download could not start in this browser.', 'error');
  }
}

async function importCareerFile(file) {
  if (!file) return;
  if (file.size > 256 * 1024) {
    note('That file is too large to be a TGG World career (limit 256 KB).', 'error');
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch {
    note('That file could not be read.', 'error');
    return;
  }
  const result = importStoredCareer(safeStorage(), text);
  note(result.message, result.tone);
  if (result.changed) {
    toast('Career imported · reloading');
    // A reload is the honest way to show the merged career in the game state.
    setTimeout(() => window.location.reload(), 1200);
  } else {
    toast('Career import finished');
  }
}

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function build() {
  const card = document.querySelector('#start .card') ?? document.querySelector('#complete .card');
  if (!card || document.getElementById('careerPanel')) return;

  const wrap = document.createElement('section');
  wrap.id = 'careerPanel';
  wrap.className = 'career-panel';
  wrap.setAttribute('style', STYLE.wrap);

  const heading = document.createElement('p');
  heading.setAttribute('style', STYLE.label);
  heading.textContent = 'Career file · works offline';

  const row = document.createElement('div');
  row.setAttribute('style', STYLE.row);

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.id = 'btnExportCareer';
  exportButton.className = 'chip-btn career-action';
  exportButton.setAttribute('style', STYLE.button);
  exportButton.textContent = 'Export career';
  exportButton.addEventListener('click', exportCareer);

  const importButton = document.createElement('button');
  importButton.type = 'button';
  importButton.id = 'btnImportCareer';
  importButton.className = 'chip-btn career-action';
  importButton.setAttribute('style', STYLE.button);
  importButton.textContent = 'Import career';
  importButton.setAttribute('aria-describedby', 'careerNote');

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'application/json,.json';
  picker.id = 'careerFile';
  picker.setAttribute('style', 'display:none');
  picker.addEventListener('change', () => {
    const file = picker.files && picker.files[0];
    picker.value = '';
    importCareerFile(file);
  });
  importButton.addEventListener('click', () => picker.click());

  row.append(exportButton, importButton);
  noteElement = document.createElement('p');
  noteElement.id = 'careerNote';
  noteElement.setAttribute('style', STYLE.note);
  noteElement.textContent = 'Moves progress between devices without a server. Local saves are kept.';

  wrap.append(heading, row, picker, noteElement);
  card.appendChild(wrap);
}

let noteElement = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', build, { once: true });
} else {
  build();
}

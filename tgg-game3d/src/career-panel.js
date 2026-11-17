// The visible Export / Import career controls and the save-health line.
//
// This is its own bundle (career.js) rather than part of game.js: it only needs
// localStorage, so it must work even if the renderer fails, and it keeps the
// large game entry untouched. build.mjs injects the script tag.

import { exportStoredCareer, importStoredCareer } from './career-transfer.js';
import { describeSaveState, readSaveState, recoverFromBackup, resetCareer, snapshotBackup } from './save-status.js';
import { SAVE_KEY } from './progress.js';

// This module is loaded before the game bundle on purpose: the game's boot path
// copies a corrupt payload over the backup key, so the readable backup has to be
// captured while it is still there.
snapshotBackup((() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})());

const TONE = { ok: '#c7ff00', warn: '#ffcc66', error: '#ff8a8a', muted: '#8d98a6' };

const STYLE = {
  wrap: 'margin-top:14px;border-top:1px solid rgba(255,255,255,.12);padding-top:12px',
  label: 'font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8d98a6;margin:0 0 8px',
  status: 'margin:0 0 10px;font-size:12px;line-height:1.45;color:#8d98a6',
  row: 'display:flex;gap:10px;flex-wrap:wrap',
  button:
    'flex:1 1 140px;min-height:44px;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);' +
    'background:transparent;color:#eef2f6;font:inherit;font-size:14px;cursor:pointer',
  danger:
    'flex:1 1 140px;min-height:44px;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,138,138,.45);' +
    'background:transparent;color:#ff8a8a;font:inherit;font-size:14px;cursor:pointer',
  note: 'margin:8px 0 0;font-size:12px;line-height:1.45;color:#8d98a6',
};

let noteElement = null;
let statusElement = null;
let recoverButton = null;
let resetButton = null;
let resetArmedTimer = null;

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
  noteElement.style.color = TONE[tone] ?? '#8d98a6';
}

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Redraws the health line and decides which recovery controls are offered. */
function refreshStatus(prefix) {
  if (!statusElement) return;
  const state = readSaveState(safeStorage());
  const described = describeSaveState(state);
  statusElement.textContent = prefix ? `${prefix} · ${described.message}` : described.message;
  statusElement.style.color = TONE[described.tone] ?? TONE.muted;
  if (recoverButton) recoverButton.hidden = !described.needsRecovery;
  if (resetButton) resetButton.hidden = state.status === 'empty' || state.status === 'unavailable';
}

function disarmReset() {
  if (!resetButton) return;
  resetButton.dataset.armed = '';
  resetButton.textContent = 'Reset career';
  resetButton.setAttribute('aria-label', 'Reset the career saved on this device');
  if (resetArmedTimer) clearTimeout(resetArmedTimer);
  resetArmedTimer = null;
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
    refreshStatus();
  }
}

function recover() {
  const result = recoverFromBackup(safeStorage());
  note(result.message, result.ok ? 'ok' : 'error');
  if (result.ok) {
    toast('Backup restored · reloading');
    setTimeout(() => window.location.reload(), 1000);
  }
}

/** Two deliberate clicks: the first only arms the button, the second erases. */
function resetCareerClicked() {
  if (!resetButton) return;
  if (resetButton.dataset.armed !== 'yes') {
    resetButton.dataset.armed = 'yes';
    resetButton.textContent = 'Tap again to erase';
    note('This clears the career on this device. Exported files and the backup stay.', 'warn');
    resetArmedTimer = setTimeout(disarmReset, 6000);
    return;
  }
  const result = resetCareer(safeStorage());
  disarmReset();
  note(result.message, result.ok ? 'ok' : 'error');
  if (result.ok) {
    toast('Career reset · reloading');
    setTimeout(() => window.location.reload(), 900);
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

  statusElement = document.createElement('p');
  statusElement.id = 'saveStatus';
  statusElement.setAttribute('style', STYLE.status);
  statusElement.setAttribute('role', 'status');
  statusElement.setAttribute('aria-live', 'polite');

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

  const repairRow = document.createElement('div');
  repairRow.setAttribute('style', STYLE.row + ';margin-top:10px');

  recoverButton = document.createElement('button');
  recoverButton.type = 'button';
  recoverButton.id = 'btnRecoverSave';
  recoverButton.className = 'chip-btn career-action';
  recoverButton.setAttribute('style', STYLE.button);
  recoverButton.textContent = 'Restore backup';
  recoverButton.hidden = true;
  recoverButton.addEventListener('click', recover);

  resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.id = 'btnResetCareer';
  resetButton.className = 'chip-btn career-action';
  resetButton.setAttribute('style', STYLE.danger);
  resetButton.textContent = 'Reset career';
  resetButton.setAttribute('aria-label', 'Reset the career saved on this device');
  resetButton.hidden = true;
  resetButton.addEventListener('click', resetCareerClicked);
  resetButton.addEventListener('blur', disarmReset);

  row.append(exportButton, importButton);
  repairRow.append(recoverButton, resetButton);

  noteElement = document.createElement('p');
  noteElement.id = 'careerNote';
  noteElement.setAttribute('style', STYLE.note);
  noteElement.textContent = 'Moves progress between devices without a server. Local saves are kept.';

  wrap.append(heading, statusElement, row, picker, repairRow, noteElement);
  card.appendChild(wrap);
  refreshStatus();

  // Multi-tab: another tab writing the same key is the one case where this tab's
  // view is stale. Say so instead of silently showing old numbers.
  window.addEventListener('storage', (event) => {
    if (event.key === SAVE_KEY || event.key === null) {
      refreshStatus('Another tab changed this career');
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshStatus();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', build, { once: true });
} else {
  build();
}

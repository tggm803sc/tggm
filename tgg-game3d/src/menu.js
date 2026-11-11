// Main menu: Continue / New game / career choice / graphics / save export-import.
// It owns only the menu DOM; the game decides what a run is.
import { CAREERS, QUALITIES, exportSave, importSave, saveSummary } from './progress.js';

const el = (id) => document.getElementById(id);

export function initMenu(handlers = {}) {
  const root = el('start');
  const saveCard = el('saveCard');
  const newCard = el('newGameCard');
  const confirmCard = el('confirmWipe');
  const careerList = el('careerList');
  const qualityList = el('qualityList');
  const aliasInput = el('aliasInput');
  const importFile = el('importFile');
  const saveAlias = el('saveAlias');
  const saveCareer = el('saveCareer');
  const saveObjective = el('saveObjective');
  const saveRelease = el('saveRelease');
  const saveWhen = el('saveWhen');
  const menuStatus = el('menuStatus');

  let save = null;
  let career = CAREERS[0].id;
  let quality = 'balanced';
  let pendingProfile = null;

  // Career buttons.
  for (const option of CAREERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'career-opt';
    button.dataset.career = option.id;
    button.textContent = option.label;
    button.setAttribute('aria-pressed', String(option.id === career));
    button.addEventListener('click', () => {
      career = option.id;
      for (const node of careerList.children) {
        node.setAttribute('aria-pressed', String(node.dataset.career === career));
      }
    });
    careerList.appendChild(button);
  }

  // Graphics buttons.
  for (const option of QUALITIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.quality = option;
    button.textContent = option;
    button.setAttribute('aria-pressed', String(option === quality));
    button.addEventListener('click', () => {
      quality = option;
      for (const node of qualityList.children) {
        node.setAttribute('aria-pressed', String(node.dataset.quality === quality));
      }
      handlers.onQuality?.(option);
    });
    qualityList.appendChild(button);
  }

  function mode(next) {
    saveCard.classList.toggle('hidden', next !== 'save');
    newCard.classList.toggle('hidden', next !== 'new');
    confirmCard.classList.toggle('hidden', next !== 'confirm');
  }

  function refresh(nextSave) {
    save = nextSave ?? null;
    if (save) {
      const summary = saveSummary(save, el('objective')?.textContent);
      saveAlias.textContent = summary.alias;
      saveCareer.textContent = summary.career;
      saveObjective.textContent = summary.objective;
      saveRelease.textContent = summary.master
        ? `${summary.release} · ${summary.master}`
        : summary.release;
      saveWhen.textContent = summary.when;
      quality = save.settings.quality;
      for (const node of qualityList.children) {
        node.setAttribute('aria-pressed', String(node.dataset.quality === quality));
      }
      mode('save');
    } else {
      mode('new');
    }
  }

  function show() {
    root.classList.remove('hidden');
  }

  function hide() {
    root.classList.add('hidden');
  }

  el('btnContinue').addEventListener('click', () => {
    hide();
    handlers.onContinue?.();
  });

  el('btnNewGame').addEventListener('click', () => {
    aliasInput.value = save?.player.alias ?? '';
    mode('new');
  });

  el('btnCancelNew').addEventListener('click', () => {
    if (save) mode('save');
  });

  el('btnCreate').addEventListener('click', () => {
    const profile = {
      alias: aliasInput.value.trim() || 'Getta',
      career,
    };
    if (save) {
      pendingProfile = profile;
      mode('confirm');
      return;
    }
    hide();
    handlers.onNewGame?.(profile);
  });

  el('btnCancelWipe').addEventListener('click', () => {
    pendingProfile = null;
    mode('save');
  });

  el('btnConfirmWipe').addEventListener('click', () => {
    const profile = pendingProfile;
    pendingProfile = null;
    hide();
    handlers.onNewGame?.(profile ?? { alias: 'Getta', career });
  });

  el('btnExport').addEventListener('click', () => {
    const text = exportSave(save);
    if (!text) {
      handlers.onError?.('Nothing to export yet');
      return;
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tgg-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    handlers.onError?.('Save exported');
  });

  el('btnImport').addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = '';
    if (!file) return;
    const text = await file.text().catch(() => '');
    const imported = importSave(text);
    if (!imported) {
      handlers.onError?.('That file is not a TGG save');
      return;
    }
    handlers.onImport?.(imported);
  });

  return {
    refresh,
    show,
    hide,
    setOnline(online) {
      menuStatus.textContent = online
        ? 'Online · cloud AI available'
        : 'Offline · local run only, cloud AI unavailable';
      menuStatus.dataset.online = String(online);
    },
    getQuality: () => quality,
  };
}

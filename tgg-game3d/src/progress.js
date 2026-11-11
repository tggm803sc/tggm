// The player save: one JSON document in the browser, engine-neutral on purpose
// so the same shape can be exported and later read by another engine.
const KEY = 'tgg.world.act1.v2';
const LEGACY_KEY = 'tgg.world.act1.v1';
const VERSION = 2;

import { normalizePattern } from './sequencer.js';
import { normalizeCargo } from './cargo.js';

// Canon release pipeline. It only moves forward, except on a new run.
export const RELEASE_ORDER = ['draft', 'mastered', 'delivery-pending', 'confirmed', 'released'];

// The last take is kept even when it was rejected, so the review survives a
// reload and a rework starts from what the engineer actually said.
function normalizeTake(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));
  return {
    accepted: Boolean(raw.accepted),
    quality: clamp(raw.quality),
    timing: clamp(raw.timing),
    arrangement: clamp(raw.arrangement),
    bpm: Math.round(Number(raw.bpm) || 96),
    at: Number(raw.at) || null,
    burst: Boolean(raw.burst),
  };
}

function normalizeProduction(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    pattern: normalizePattern(source.pattern),
    take: normalizeTake(source.take),
    captures: Math.max(0, Math.floor(Number(source.captures) || 0)),
  };
}

export const CAREERS = [
  { id: 'artist', label: 'Music artist' },
  { id: 'producer', label: 'Producer' },
  { id: 'dj', label: 'DJ' },
  { id: 'actor', label: 'Actor / filmmaker' },
  { id: 'creator', label: 'Content creator' },
  { id: 'entrepreneur', label: 'Entrepreneur' },
  { id: 'promoter', label: 'Event promoter' },
];

export const QUALITIES = ['low', 'balanced', 'high'];

// Studio 808, The Vault, then the Salt Flats cargo run.
const MAX_STAGE = 2;

export function careerLabel(id) {
  return CAREERS.find((career) => career.id === id)?.label ?? CAREERS[0].label;
}

function cleanAlias(value) {
  const text = typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : '';
  return (text || 'Getta').slice(0, 20);
}

// Accepts anything that looks like a TGG save (including the v1 shape) and
// returns a document the game can trust. Nothing outside the schema survives.
export function normalizeSave(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.format && raw.format !== 'tgg-save') return null;

  const release = raw.release && typeof raw.release === 'object' ? raw.release : {};
  const player = raw.player && typeof raw.player === 'object' ? raw.player : {};
  const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  const car = raw.car && Number.isFinite(Number(raw.car.x)) ? raw.car : null;
  const van = raw.van && Number.isFinite(Number(raw.van.x)) ? raw.van : null;

  const stage = Math.max(0, Math.min(MAX_STAGE, Math.floor(Number(raw.stage) || 0)));
  const releaseState = RELEASE_ORDER.includes(release.state) ? release.state : 'draft';

  return {
    version: VERSION,
    format: 'tgg-save',
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    player: {
      alias: cleanAlias(player.alias),
      career: CAREERS.some((career) => career.id === player.career) ? player.career : CAREERS[0].id,
      createdAt: Number(player.createdAt) || Date.now(),
    },
    settings: {
      quality: QUALITIES.includes(settings.quality) ? settings.quality : 'balanced',
      muted: Boolean(settings.muted),
    },
    stage,
    complete: Boolean(raw.complete),
    release: {
      state: releaseState,
      quality: Math.max(0, Math.min(100, Number(release.quality) || 0)),
      hash: typeof release.hash === 'string' ? release.hash.slice(0, 16) : null,
      title: typeof release.title === 'string' ? release.title.slice(0, 40) : null,
      bpm: Number(release.bpm) || 96,
      key: typeof release.key === 'string' ? release.key.slice(0, 12) : 'A min',
    },
    studioQuality: Math.max(0, Math.min(100, Number(raw.studioQuality) || 0)),
    radioAvailable: Boolean(raw.radioAvailable),
    directorSeed: Number(raw.directorSeed) || Date.now() % 2147483647,
    production: normalizeProduction(raw.production),
    ui: {
      lastScreen: ['phone', 'map', 'missions', 'garage', 'settings', 'pause'].includes(raw.ui?.lastScreen)
        ? raw.ui.lastScreen
        : null,
    },
    journal: {
      completed: Array.isArray(raw.journal?.completed)
        ? [...new Set(raw.journal.completed.filter((n) => Number.isInteger(n) && n >= 0 && n <= MAX_STAGE))].sort()
        : [],
      // Set only when the cargo run lands: the hook the Maya storyline reads.
      maya: Boolean(raw.journal?.maya),
    },
    cargo: normalizeCargo(raw.cargo),
    van: van
      ? { x: Number(van.x), z: Number(van.z), heading: Number(van.heading) || 0 }
      : null,
    car: car
      ? { x: Number(car.x), z: Number(car.z), heading: Number(car.heading) || 0 }
      : null,
    stats: {
      runs: Math.max(0, Math.floor(Number(stats.runs) || 0)),
      bestTake: Math.max(0, Math.min(100, Number(stats.bestTake) || 0)),
    },
  };
}

// A brand new career: profile first, everything else at its opening state.
export function newCareerSave({ alias, career, quality = 'balanced' } = {}) {
  const now = Date.now();
  return normalizeSave({
    createdAt: now,
    updatedAt: now,
    player: { alias, career, createdAt: now },
    settings: { quality },
    stage: 0,
    complete: false,
    release: { state: 'draft' },
    stats: { runs: 1, bestTake: 0 },
  });
}

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return normalizeSave(JSON.parse(raw));

    // A run from the previous build is upgraded, not discarded.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (!legacy) return null;
    const upgraded = normalizeSave(JSON.parse(legacy));
    if (!upgraded) return null;
    window.localStorage.setItem(KEY, JSON.stringify(upgraded));
    window.localStorage.removeItem(LEGACY_KEY);
    return upgraded;
  } catch {
    return null;
  }
}

export function saveProgress(patch = {}) {
  try {
    const prior = loadProgress() ?? {};
    const next = normalizeSave({
      ...prior,
      ...patch,
      player: { ...(prior.player ?? {}), ...(patch.player ?? {}) },
      settings: { ...(prior.settings ?? {}), ...(patch.settings ?? {}) },
      release: { ...(prior.release ?? {}), ...(patch.release ?? {}) },
      production: { ...(prior.production ?? {}), ...(patch.production ?? {}) },
      journal: { ...(prior.journal ?? {}), ...(patch.journal ?? {}) },
      stats: { ...(prior.stats ?? {}), ...(patch.stats ?? {}) },
      updatedAt: Date.now(),
    });
    if (!next) return prior || null;
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function clearProgress() {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Storage can be blocked; a run without saving is still a playable run.
  }
}

export function exportSave(save) {
  const document = normalizeSave(save ?? loadProgress());
  if (!document) return null;
  return JSON.stringify({ ...document, exportedAt: new Date().toISOString() }, null, 2);
}

export function importSave(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  try {
    return normalizeSave(JSON.parse(text));
  } catch {
    return null;
  }
}

// Hands the player a JSON file they can keep or move to another device.
export function downloadSave(save, filename) {
  const text = exportSave(save ?? loadProgress());
  if (!text) return false;
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename ?? `tgg-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

// What the main menu shows without reading the whole save.
export function saveSummary(save, objective) {
  if (!save) return null;
  const played = new Date(save.updatedAt);
  return {
    alias: save.player.alias,
    career: careerLabel(save.player.career),
    objective: save.complete ? 'Act I complete' : objective,
    release: save.release.state,
    master: save.release.title,
    when: Number.isNaN(played.getTime())
      ? 'unknown'
      : played.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
  };
}

// Same take in, same id out, so a refresh cannot silently change the master.
export function mixHash(quality, scores, seed) {
  let hash = 2166136261 ^ (Number(seed) >>> 0);
  const push = (code) => {
    hash ^= code & 0xff;
    hash = Math.imul(hash, 16777619) >>> 0;
  };
  push(Number(quality) || 0);
  for (const score of scores ?? []) push(Number(score) || 0);
  for (const char of String(seed)) push(char.charCodeAt(0));
  return hash.toString(16).padStart(8, '0');
}

// Wires src/mission.js into the HUD and completion card.
//
// Same discipline as tools/verified-save.mjs: exact source anchors, and the build
// throws if either anchor is missing, so the HUD cannot silently fall back to
// stale wording while the tested module says something else.

export const IMPORT_ANCHOR = "import * as THREE from 'three';";

export const STAGE_BLOCK = [
  '  stageProgressText.textContent = state.complete',
  "    ? 'Act I complete'",
  '    : `Stage ${state.stage + 1} of ${stops.length}`;',
].join('\n');

export const STAGE_REPLACEMENT =
  '  stageProgressText.textContent = stageProgress({ stage: state.stage, total: stops.length, complete: state.complete, legs: state.legs });';

export const SUMMARY_BLOCK = [
  '  runSummaryText.textContent = state.complete',
  '    ? `Run ${formatTime(state.runTime)}${splits ? ` (${splits})` : \'\'} · ${lastSaved}`',
  "    : '';",
].join('\n');

export const SUMMARY_REPLACEMENT =
  "  runSummaryText.textContent = state.complete\n    ? completionSummary({ runTime: state.runTime, legs: state.legs, best: state.best, saved: lastSaved })\n    : '';";

const MISSION_IMPORT = "import { completionSummary, stageProgress } from './mission.js';";

/**
 * @param {string} source raw src/main.js (after applyVerifiedSave)
 * @returns {string} source whose HUD line and completion summary come from mission.js
 * @throws if the anchors are missing
 */
export function applyMissionHud(source) {
  if (typeof source !== 'string' || source.trim() === '') {
    throw new Error('mission-hud: empty main.js');
  }
  if (source.includes(MISSION_IMPORT)) return source; // already applied
  if (!source.includes(STAGE_BLOCK)) {
    throw new Error('mission-hud: the stage progress line changed; update tools/mission-hud.mjs');
  }
  if (!source.includes(SUMMARY_BLOCK)) {
    throw new Error('mission-hud: the run summary line changed; update tools/mission-hud.mjs');
  }
  if (!source.includes(IMPORT_ANCHOR)) {
    throw new Error('mission-hud: could not find the THREE import to attach the mission import to');
  }

  const patched = source
    .replace(STAGE_BLOCK, STAGE_REPLACEMENT)
    .replace(SUMMARY_BLOCK, SUMMARY_REPLACEMENT);
  if (patched.includes(STAGE_BLOCK) || patched.includes(SUMMARY_BLOCK)) {
    throw new Error('mission-hud: an anchor survived the replacement');
  }
  return patched.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\n${MISSION_IMPORT}`);
}

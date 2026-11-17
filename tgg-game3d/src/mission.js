// Mission progress wording, as pure functions.
//
// The game tracks `state.stage` (index into `stops`), `state.legs` (completed leg
// times) and `state.complete`. This module turns that state into the one line the
// HUD shows and the completion summary, so the wording can be tested without a
// renderer and cannot drift between the HUD and the completion card.

import { formatTime } from './progress.js';

/** How many checkpoints are behind the player, derived from completed legs. */
export function checkpointsLogged(legs) {
  return Array.isArray(legs) ? legs.length : 0;
}

/**
 * The persistent HUD line.
 * @param {{ stage?: number, total?: number, complete?: boolean, legs?: number[] }} state
 */
export function stageProgress(state = {}) {
  const total = Math.max(1, Math.floor(state.total ?? 1));
  const complete = Boolean(state.complete);
  const logged = checkpointsLogged(state.legs);

  if (complete) {
    const plural = total === 1 ? 'stop' : 'stops';
    return `Act I complete · ${total} ${plural} · ${logged} checkpoint${logged === 1 ? '' : 's'}`;
  }

  const stage = Math.min(Math.max(0, Math.floor(state.stage ?? 0)), total - 1);
  const isFinal = stage === total - 1;
  const position = `Stop ${stage + 1} of ${total}${isFinal ? ' · final' : ''}`;
  return logged === 0 ? position : `${position} · ${logged} checkpoint${logged === 1 ? '' : 's'} logged`;
}

/**
 * The completion card's line: run time, per-stop splits, and what was saved.
 * Nothing here invents a reward; it only reports what the run produced.
 */
export function completionSummary(state = {}) {
  const runTime = Number.isFinite(state.runTime) ? state.runTime : 0;
  const legs = Array.isArray(state.legs) ? state.legs : [];
  const splits = legs.map((time, index) => `${index + 1}: ${formatTime(time)}`).join(' · ');
  const saved = typeof state.saved === 'string' && state.saved !== '' ? state.saved : 'not saved';
  const best = Number.isFinite(state.best) ? ` · best ${formatTime(state.best)}` : '';
  return `Run ${formatTime(runTime)}${splits ? ` (${splits})` : ''}${best} · ${saved}`;
}

/** Arriving at the last stop completes the act; anything earlier is a checkpoint. */
export function isFinalStop(stage, total) {
  const last = Math.max(0, Math.floor(total ?? 1)) - 1;
  return Math.floor(stage ?? 0) >= last;
}

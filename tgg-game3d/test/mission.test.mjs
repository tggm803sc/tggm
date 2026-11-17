import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkpointsLogged, completionSummary, isFinalStop, stageProgress } from '../src/mission.js';
import {
  STAGE_BLOCK,
  SUMMARY_BLOCK,
  applyMissionHud,
} from '../tools/mission-hud.mjs';
import { applyVerifiedSave } from '../tools/verified-save.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const mainPath = resolve(here, '../src/main.js');

test('the opening objective names the first stop, not a bare stage number', () => {
  assert.equal(stageProgress({ stage: 0, total: 2, legs: [] }), 'Stop 1 of 2');
  assert.equal(stageProgress({ stage: 0, total: 3, legs: [] }), 'Stop 1 of 3');
});

test('after the first checkpoint the line shows both the next stop and the count', () => {
  assert.equal(stageProgress({ stage: 1, total: 2, legs: [32.4] }), 'Stop 2 of 2 · final · 1 checkpoint logged');
  assert.equal(stageProgress({ stage: 1, total: 3, legs: [12, 30] }), 'Stop 2 of 3 · 2 checkpoints logged');
});

test('the final stop is marked as final and completion keeps the totals', () => {
  assert.equal(isFinalStop(1, 2), true);
  assert.equal(isFinalStop(0, 2), false);
  assert.equal(isFinalStop(0, 1), true);
  assert.equal(stageProgress({ stage: 1, total: 2, complete: true, legs: [30, 12] }), 'Act I complete · 2 stops · 2 checkpoints');
  assert.equal(stageProgress({ stage: 0, total: 1, complete: true, legs: [] }), 'Act I complete · 1 stop · 0 checkpoints');
});

test('out-of-range stage values cannot produce impossible wording', () => {
  assert.equal(stageProgress({ stage: 9, total: 2, legs: [] }), 'Stop 2 of 2 · final');
  assert.equal(stageProgress({ stage: -3, total: 2, legs: [] }), 'Stop 1 of 2');
  assert.equal(stageProgress({}), 'Stop 1 of 1 · final');
});

test('checkpointsLogged tolerates missing or odd leg arrays', () => {
  assert.equal(checkpointsLogged([1, 2, 3]), 3);
  assert.equal(checkpointsLogged(undefined), 0);
  assert.equal(checkpointsLogged('nope'), 0);
});

test('the completion summary reports the real run, splits, best and save result', () => {
  const summary = completionSummary({
    runTime: 65.5,
    legs: [30, 35.5],
    best: 60,
    saved: 'saved on this device',
  });
  assert.equal(summary, 'Run 1:05.5 (1: 0:30.0 · 2: 0:35.5) · best 1:00.0 · saved on this device');
});

test('a failed save is reported honestly on the completion card', () => {
  const summary = completionSummary({ runTime: 12, legs: [12], saved: 'not saved · storage blocked or full' });
  assert.match(summary, /not saved · storage blocked or full/);
  assert.doesNotMatch(summary, /best/);
});

test('the HUD and summary anchors exist in the real main.js and are replaced', async () => {
  const source = applyVerifiedSave(await readFile(mainPath, 'utf8'));
  assert.ok(source.includes(STAGE_BLOCK), 'stage line anchor missing');
  assert.ok(source.includes(SUMMARY_BLOCK), 'summary line anchor missing');

  const patched = applyMissionHud(source);
  assert.ok(patched.includes('stageProgress({ stage: state.stage'));
  assert.ok(patched.includes('completionSummary({ runTime: state.runTime'));
  assert.equal(patched.includes(STAGE_BLOCK), false);
  assert.equal(patched.includes(SUMMARY_BLOCK), false);
  // idempotent
  assert.equal(applyMissionHud(patched), patched);
});

test('both codemods compose, and the save path is still verified', async () => {
  const source = await readFile(mainPath, 'utf8');
  const patched = applyMissionHud(applyVerifiedSave(source));
  assert.ok(patched.includes('writeProgressVerified(window.localStorage, progress)'));
  assert.ok(patched.includes("from './mission.js'"));
  assert.equal(patched.includes('window.localStorage.setItem(SAVE_KEY'), false);
});

test('a changed anchor fails the build instead of shipping stale wording', () => {
  assert.throws(() => applyMissionHud('const x = 1;'), /stage progress line changed/);
  assert.throws(() => applyMissionHud(''), /empty/);
  assert.throws(() => applyMissionHud(`${STAGE_BLOCK}\n`), /run summary line changed/);
});

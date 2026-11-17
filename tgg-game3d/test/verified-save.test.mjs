import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IMPORT_ANCHOR,
  VERIFIED_BLOCK,
  WRITE_BLOCK,
  applyVerifiedSave,
} from '../tools/verified-save.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const mainPath = resolve(here, '../src/main.js');

test('main.js still contains the exact write block the codemod expects', async () => {
  const source = await readFile(mainPath, 'utf8');
  assert.ok(source.includes(WRITE_BLOCK), 'writeProgress() write block moved or changed');
  assert.ok(source.includes(IMPORT_ANCHOR), 'THREE import anchor moved');
});

test('the completion save is routed through the verified writer', async () => {
  const source = await readFile(mainPath, 'utf8');
  const patched = applyVerifiedSave(source);
  assert.ok(patched.includes(VERIFIED_BLOCK));
  assert.ok(patched.includes("import { writeProgressVerified } from './save-status.js';"));
  // the direct write to the live key must not survive
  assert.equal(patched.includes('window.localStorage.setItem(SAVE_KEY'), false);
  // and it is idempotent: patching twice must equal patching once
  assert.equal(applyVerifiedSave(patched), patched);
});

test('a changed write block fails the build instead of silently shipping', () => {
  assert.throws(() => applyVerifiedSave('function writeProgress() { return "saved"; }'), /changed/);
  assert.throws(() => applyVerifiedSave(''), /empty/);
  assert.throws(() => applyVerifiedSave(`${WRITE_BLOCK}\n`), /THREE import/);
});

test('the newer-build and read-only branches are untouched', async () => {
  const source = await readFile(mainPath, 'utf8');
  const patched = applyVerifiedSave(source);
  // writeProgress must still refuse to write for a newer-build save, before any
  // storage call happens.
  assert.ok(patched.includes("return progressStatus === 'newer'"));
  assert.ok(patched.includes('if (!progressWritable)'));
  assert.ok(patched.indexOf('if (!progressWritable)') < patched.indexOf(VERIFIED_BLOCK));
});

// Routes the game's completion save through the verified writer.
//
// main.js is the large game entry, so rather than hand-editing it this is a
// source transformation applied at bundle time. It is deliberately strict: if
// the exact write block is not found the build throws, so a future edit to
// main.js can never silently ship an unverified save path.

export const IMPORT_ANCHOR = "import * as THREE from 'three';";

/** The write block as it exists in main.js today. */
export const WRITE_BLOCK = [
  '  try {',
  '    window.localStorage.setItem(SAVE_KEY, serializeProgress(progress));',
  "    return 'saved on this device';",
  '  } catch {',
  "    return 'not saved · storage blocked';",
  '  }',
].join('\n');

export const VERIFIED_BLOCK = [
  '  const verified = writeProgressVerified(window.localStorage, progress);',
  '  return verified.message;',
].join('\n');

const VERIFIED_IMPORT = "import { writeProgressVerified } from './save-status.js';";

/**
 * @param {string} source raw src/main.js
 * @returns {string} source with the completion save routed through the verified writer
 * @throws if the expected write block is missing
 */
export function applyVerifiedSave(source) {
  if (typeof source !== 'string' || source.trim() === '') {
    throw new Error('verified-save: empty main.js');
  }
  if (source.includes(VERIFIED_IMPORT)) return source; // already applied
  if (!source.includes(WRITE_BLOCK)) {
    throw new Error(
      'verified-save: the writeProgress() save block changed. Update tools/verified-save.mjs so the completion save keeps using writeProgressVerified().',
    );
  }
  if (!source.includes(IMPORT_ANCHOR)) {
    throw new Error('verified-save: could not find the THREE import to attach the writer import to');
  }

  const withoutRaw = source.replace(WRITE_BLOCK, VERIFIED_BLOCK);
  if (withoutRaw.includes('window.localStorage.setItem(SAVE_KEY')) {
    throw new Error('verified-save: a direct SAVE_KEY write survived the transformation');
  }
  return withoutRaw.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\n${VERIFIED_IMPORT}`);
}

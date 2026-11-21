import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// WU-0113: the phone controls are measured in a real 375x667 and 360x640
// viewport, but a stylesheet edit could shrink them again between measurements.
// This pins the declared sizes to the 44x44 WCAG 2.5.5 minimum.

const here = dirname(fileURLToPath(import.meta.url));
const stylePath = resolve(here, '../style.css');
const TOUCH_MIN = 44;

const css = (await readFile(stylePath, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');

/** Bodies of every rule whose selector list contains this exact selector. */
function blocks(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.matchAll(re)].map((match) => match[1]);
}

/** The floor of a width/height declaration: plain px, or the first arm of clamp(). */
function floorOf(body, property) {
  const declaration = body
    .split(';')
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${property}:`));
  if (!declaration) return null;
  const clamp = declaration.match(/clamp\(\s*(\d+(?:\.\d+)?)px/);
  if (clamp) return Number(clamp[1]);
  const plain = declaration.match(/(\d+(?:\.\d+)?)px/);
  return plain ? Number(plain[1]) : null;
}

test('a single 44px touch token exists for controls that are not sized by clamp()', () => {
  const match = css.match(/--touch:\s*(\d+(?:\.\d+)?)px/);
  assert.ok(match, 'the --touch token is gone');
  assert.equal(Number(match[1]), TOUCH_MIN);
});

test('the map chips are at least 44x44 instead of the old 34px', () => {
  const [chip] = blocks('.chip-btn');
  assert.ok(chip, '.chip-btn rule is gone');
  for (const property of ['width', 'height']) {
    const value = chip
      .split(';')
      .map((line) => line.trim())
      .find((line) => line.startsWith(`${property}:`));
    assert.ok(value, `.chip-btn has no ${property}`);
    assert.match(value, /var\(--touch\)/, `.chip-btn ${property} no longer uses --touch`);
  }
  assert.equal(/34px/.test(chip), false, '.chip-btn is back to the 34px square');
});

test('every phone drive control declares at least 44x44 before any clamp() scaling', () => {
  const controls = ['.steer-btn', '.pedal.gas', '.pedal.brake', '.pedal.handbrake'];
  for (const selector of controls) {
    const found = blocks(selector);
    assert.ok(found.length > 0, `${selector} rule is gone`);
    for (const body of found) {
      for (const property of ['width', 'height']) {
        const size = floorOf(body, property);
        if (size === null) continue;
        assert.ok(
          size >= TOUCH_MIN,
          `${selector} ${property} floor ${size}px is under ${TOUCH_MIN}px`,
        );
      }
    }
  }
});

test('the portrait thumb layout still sizes its pedals for a thumb', () => {
  // The portrait block is the one that applies at 375x667 and 360x640, so its
  // explicit pixel sizes are the ones a phone actually gets.
  const portrait = css.match(
    /@media \(max-width: 520px\) and \(orientation: portrait\) \{([\s\S]*?)\n\}/,
  );
  assert.ok(portrait, 'the portrait thumb layout media block moved');
  const body = portrait[1];
  for (const selector of ['.pedal.handbrake', '.pedal.brake', '.pedal.gas']) {
    const rule = new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`).exec(body);
    assert.ok(rule, `${selector} is no longer sized in the portrait block`);
    for (const property of ['width', 'height']) {
      const size = floorOf(rule[1], property);
      assert.ok(size !== null && size >= TOUCH_MIN, `${selector} ${property} is under ${TOUCH_MIN}px`);
    }
  }
});

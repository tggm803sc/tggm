import test from 'node:test';
import assert from 'node:assert/strict';

import { awardContract, createCareer, levelFor, normalizeCareer } from '../src/career.js';
import { normalizeSave } from '../src/progress.js';

test('a paid round trip survives the save round trip', () => {
  const career = createCareer();
  const paid = awardContract(career, { cash: 850, xp: 120 });
  assert.equal(paid.cash, 850);

  const saved = normalizeSave({ stage: 2, career });
  assert.equal(saved.career.cash, 850, 'cash was lost on save');
  assert.equal(saved.career.xp, 120, 'xp was lost on save');
  assert.equal(saved.career.contracts, 1);
  assert.equal(saved.career.level, levelFor(120));
});

test('an old save with no career loads at zero rather than breaking', () => {
  const saved = normalizeSave({ stage: 2, cargo: { state: 'delivered' } });
  assert.deepEqual(
    [saved.career.cash, saved.career.xp, saved.career.contracts, saved.career.level],
    [0, 0, 0, 1],
  );
});

test('junk in the career field cannot create negative or fractional money', () => {
  const saved = normalizeSave({ career: { cash: -50, xp: 'abc', contracts: 3.7 } });
  assert.equal(saved.career.cash, 0);
  assert.equal(saved.career.xp, 0);
  assert.equal(saved.career.contracts, 3);
});

test('level is derived from xp, never trusted from the save', () => {
  const saved = normalizeSave({ career: { cash: 10, xp: 1000, level: 99 } });
  assert.equal(saved.career.level, levelFor(1000));
  assert.notEqual(saved.career.level, 99);
  assert.deepEqual(
    [normalizeCareer(null).cash, normalizeCareer(undefined).xp],
    [0, 0],
  );
});

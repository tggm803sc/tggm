// A deploy that keeps the same script URL can be masked by a cached copy, which
// is exactly what happened: the page ran a bundle from the previous deploy while
// the server served the new one. These checks fail if the built shell goes back
// to a stable bundle name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const built = existsSync(join(dist, 'index.html'));

test('the built shell loads a content-hashed bundle', (t) => {
  if (!built) {
    t.skip('dist/ is not built yet');
    return;
  }
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const match = html.match(/src="\.\/(game\.[0-9a-f]{10}\.js)"/);
  assert.ok(match, 'dist/index.html does not point at a hashed bundle');
  assert.ok(!html.includes('src="./game.js"'), 'the shell still points at the stable game.js');
  assert.ok(existsSync(join(dist, match[1])), `the built bundle ${match[1]} is missing`);
});

test('the service worker caches the hashed bundle, not a stale name', (t) => {
  if (!built) {
    t.skip('dist/ is not built yet');
    return;
  }
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/game\.[0-9a-f]{10}\.js'/, 'sw.js still caches ./game.js');
  assert.match(sw, /const CACHE = 'tgg-shell-[0-9a-f]{10}'/, 'the cache name does not change per build');
});

test('no unhashed bundle is left in the build output', (t) => {
  if (!built) {
    t.skip('dist/ is not built yet');
    return;
  }
  const bundles = readdirSync(dist).filter((name) => /^game(\.|$)/.test(name));
  assert.ok(bundles.length > 0, 'no bundle was built at all');
  assert.ok(
    bundles.every((name) => /^game\.[0-9a-f]{10}\.js$/.test(name)),
    `unhashed bundle left behind: ${bundles.join(', ')}`,
  );
});

// A silent boot failure is the worst failure this project has: the build is
// green, the tests pass, and the game dies before it installs its debug hook with
// no error on screen. This checks the two things that would have caught the last
// one — the world actually builds, and the boot guard exists in the shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Enough of a canvas for sign textures: gradients return their own stub so
// addColorStop exists, and measureText reports a width.
function makeContext() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'measureText') return () => ({ width: 12 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => makeGradient();
        }
        return () => {};
      },
    },
  );
}

function makeGradient() {
  return new Proxy(
    { addColorStop: () => {} },
    { get: (target, prop) => (prop in target ? target[prop] : () => makeGradient()) },
  );
}

function installDom() {
  const element = () => ({
    width: 0,
    height: 0,
    style: {},
    getContext: () => makeContext(),
    toDataURL: () => 'data:,',
    addEventListener: () => {},
    appendChild: () => {},
  });
  globalThis.document = {
    createElement: element,
    getElementById: () => null,
    querySelector: () => null,
    addEventListener: () => {},
  };
}

test('the world builds without throwing', async () => {
  const THREE = await import('three');
  globalThis.THREE = THREE;
  installDom();
  const { createCity } = await import('../src/city.js');
  const city = createCity();
  assert.ok(city && city.group, 'createCity returned no group');
  assert.ok(city.group.children.length > 10, 'the city built almost nothing');
});

test('the airport still contains its landmarks', async () => {
  const THREE = await import('three');
  globalThis.THREE = THREE;
  installDom();
  const { createCity, LANDMARKS } = await import('../src/city.js');
  const city = createCity();
  const airport = LANDMARKS.airport;
  assert.equal(airport.name, 'Salt Flats');
  let nearAirport = 0;
  city.group.traverse((node) => {
    if (!node.isMesh) return;
    const { x, z } = node.position;
    if (Math.abs(x - airport.x) < 60 && Math.abs(z - airport.z) < 60) nearAirport += 1;
  });
  assert.ok(nearAirport > 20, `only ${nearAirport} airport meshes were built`);
});

test('the shell keeps a boot guard that reports a stalled module', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('__tggBootReport'), 'index.html lost its boot reporter');
  assert.ok(html.includes('bootError'), 'the boot guard cannot show anything');
  assert.ok(
    html.includes('!window.__tggReady'),
    'the boot guard no longer watches for a module that never finished starting',
  );
});

// Runs the inline guard itself, with a timer we fire by hand, so the detection
// path is tested instead of assumed.
function runGuard({ hash, hookPresent, fireError }) {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/g).find((s) => s.includes('__tggBootReport'));
  assert.ok(script, 'the boot guard script is missing from index.html');
  const timers = [];
  const listeners = [];
  const node = { textContent: '', id: '', className: '' };
  const windowStub = {
    location: { hash },
    addEventListener: (name, fn) => listeners.push([name, fn]),
    // The guard schedules through window.setTimeout, not the global one.
    setTimeout: (fn) => {
      timers.push(fn);
      return timers.length;
    },
  };
  if (hookPresent) { windowStub.__tgg = {}; windowStub.__tggReady = true; }
  const sandbox = {
    window: windowStub,
    document: {
      getElementById: () => null,
      createElement: () => node,
      body: { appendChild: () => {} },
    },
    setTimeout: (fn) => {
      timers.push(fn);
      return timers.length;
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(script.replace(/^<script>|<\/script>$/g, ''), sandbox);
  if (fireError) {
    for (const [name, fn] of listeners) {
      if (name === 'error') fn({ error: new Error('world build threw') });
    }
  }
  for (const fn of timers) fn();
  return node.textContent;
}

test('the guard reports a module that never reached the hook', () => {
  const text = runGuard({ hash: '#debug', hookPresent: false });
  assert.match(text, /never finished starting/);
});

test('the guard stays quiet when the module reported ready', () => {
  assert.equal(runGuard({ hash: '#debug', hookPresent: true }), '');
  assert.equal(runGuard({ hash: '', hookPresent: true }), '');
});

test('a module that never started is reported even without #debug', () => {
  assert.match(runGuard({ hash: '', hookPresent: false }), /never finished starting/);
});

test('the guard surfaces a thrown error by name', () => {
  const text = runGuard({ hash: '#debug', hookPresent: false, fireError: true });
  assert.match(text, /world build threw/);
});

test('the debug hook the guard waits for still exists', () => {
  const main = readFileSync(join(root, 'src/main.js'), 'utf8');
  assert.ok(main.includes("window.location.hash === '#debug'"), 'the hook guard is gone');
  assert.ok(main.includes('window.__tgg ='), 'the debug hook is gone');
});

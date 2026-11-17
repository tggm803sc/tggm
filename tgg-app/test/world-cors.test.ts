import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins, corsHeaders } from '../src/lib/world/cors.ts';

const request = (origin?: string) => ({
  headers: {
    get: (name: string) => (name.toLowerCase() === 'origin' ? origin ?? null : null),
  },
});

test('the GitHub Pages build is allowed with credentials', () => {
  const headers = corsHeaders(request('https://tggm803sc.github.io'), {});
  assert.equal(headers['access-control-allow-origin'], 'https://tggm803sc.github.io');
  assert.equal(headers['access-control-allow-credentials'], 'true');
  assert.equal(headers.vary, 'origin');
  assert.equal(headers['access-control-allow-methods'].includes('PUT'), true);
});

test('an unlisted origin gets no access headers at all', () => {
  assert.deepEqual(corsHeaders(request('https://evil.example'), {}), {});
});

test('a same-origin request needs no CORS headers', () => {
  // The app serves the game at /game/, so this is the normal case.
  assert.deepEqual(corsHeaders(request(), {}), {});
});

test('TGG_WORLD_ALLOWED_ORIGINS extends the list and is trimmed', () => {
  const env = { TGG_WORLD_ALLOWED_ORIGINS: ' https://a.example , ,https://b.example ' };
  assert.deepEqual(allowedOrigins(env), [
    'https://tggm803sc.github.io',
    'https://a.example',
    'https://b.example',
  ]);
  assert.equal(
    corsHeaders(request('https://b.example'), env)['access-control-allow-origin'],
    'https://b.example',
  );
});

test('preflight advertises the JSON content type the client sends', () => {
  const headers = corsHeaders(request('https://tggm803sc.github.io'), {});
  assert.equal(headers['access-control-allow-headers'], 'content-type');
});

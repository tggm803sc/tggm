// Optional server-side career sync for TGG World.
//
// The device save in localStorage is always the source of truth for play: this
// module only adds a second copy on the TGG app's career API. When the game is
// served by the app at /game/, the API is same-origin. Every failure (no
// server, not signed in, timeout) degrades to "local only" and never blocks a
// frame, so the GitHub Pages build keeps working exactly as before.

export const SYNC_TIMEOUT_MS = 4000;

const ms = (seconds) =>
  typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0
    ? Math.round(seconds * 1000)
    : null;

const seconds = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value / 1000 : null;

/**
 * Where the career API lives. An empty string means same-origin, which is what
 * the app-served build uses; a meta tag or ?api= names another host, and an
 * unusable value disables sync rather than pointing at something unexpected.
 */
export function resolveApiBase(options = {}) {
  const { pageOrigin = '', override = '', meta = '' } = options;
  const raw = String(override || meta || '').trim();
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw, pageOrigin || 'http://localhost');
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return url.origin;
}

/** Local progress (seconds) as the server's save body (milliseconds). */
export function progressToSave(progress, revision = 0) {
  const runs = Number.isInteger(progress?.runs) && progress.runs >= 0 ? progress.runs : 0;
  return {
    version: 2,
    revision: Number.isInteger(revision) && revision >= 0 ? revision : 0,
    bestRunMs: ms(progress?.best),
    runs,
    career: { lastRunMs: ms(progress?.lastRun) },
  };
}

/** A stored server save back in the shape the local save uses. */
export function saveToProgress(save) {
  const runs = Number.isInteger(save?.runs) && save.runs >= 0 ? save.runs : 0;
  return {
    version: 2,
    best: seconds(save?.bestRunMs),
    runs,
    lastRun: seconds(save?.career?.lastRunMs),
  };
}

/**
 * Two devices both played: keep the faster best, the larger run count, and the
 * most recent local run. Never lets a merge make a player's record worse.
 */
export function mergeProgress(local, remote) {
  const mine = local ?? {};
  const theirs = remote ?? {};
  const best =
    mine.best === null || mine.best === undefined
      ? theirs.best ?? null
      : theirs.best === null || theirs.best === undefined
        ? mine.best
        : Math.min(mine.best, theirs.best);
  return {
    version: 2,
    best,
    runs: Math.max(Number(mine.runs) || 0, Number(theirs.runs) || 0),
    lastRun: mine.lastRun ?? theirs.lastRun ?? null,
  };
}

/** True when the device holds a result the server has not seen yet. */
export function localBeatsRemote(local, remote) {
  const mine = local?.best ?? null;
  const theirs = remote?.best ?? null;
  if (mine === null) return false;
  if (theirs === null) return true;
  return mine < theirs - 0.0005;
}

const classify = (status) => {
  if (status === 401) return 'signed-out';
  if (status === 0) return 'unreachable';
  return 'failed';
};

/**
 * Thin client over /api/world/{save,runs}. `state` is always one of
 * disabled | ok | conflict | signed-out | unreachable | failed, so callers can
 * report what happened without handling exceptions.
 */
export function createCloudSave(options = {}) {
  const {
    base = '',
    fetchImpl = globalThis.fetch,
    timeoutMs = SYNC_TIMEOUT_MS,
  } = options;
  const enabled = typeof base === 'string' && typeof fetchImpl === 'function';

  async function request(path, init = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method: init.method ?? 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: controller ? controller.signal : undefined,
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return { status: response.status, payload };
    } catch {
      return { status: 0, payload: null };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    enabled,
    base,
    async load() {
      if (!enabled) return { state: 'disabled' };
      const result = await request('/api/world/save');
      if (result.status === 200 && result.payload?.ok) {
        return { state: 'ok', save: result.payload.save ?? null };
      }
      return { state: classify(result.status), status: result.status };
    },
    async push(progress, revision = 0) {
      if (!enabled) return { state: 'disabled' };
      const result = await request('/api/world/save', {
        method: 'PUT',
        body: progressToSave(progress, revision),
      });
      if (result.status === 200 || result.status === 201) {
        return { state: 'ok', save: result.payload?.save ?? null };
      }
      if (result.status === 409 && result.payload?.save) {
        return { state: 'conflict', save: result.payload.save };
      }
      return { state: classify(result.status), status: result.status };
    },
    async submitRun(run) {
      if (!enabled) return { state: 'disabled' };
      const result = await request('/api/world/runs', { method: 'POST', body: run });
      if (result.status === 200 || result.status === 201) {
        return {
          state: 'ok',
          duplicate: Boolean(result.payload?.duplicate),
          save: result.payload?.save ?? null,
        };
      }
      return { state: classify(result.status), status: result.status };
    },
  };
}

/** Idempotency key for one finished run; retries reuse the same id. */
export function makeRunId(random = Math.random, now = Date.now) {
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `run-${now()}-${Math.floor(random() * 1e9).toString(36)}`;
  return rand.length >= 8 ? rand : `run-${rand}`;
}

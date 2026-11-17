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

/**
 * A finished run that has not been acknowledged by the server yet.
 *
 * The run id is minted once and then reused for every retry, so a POST that
 * reached the database but lost its response cannot be counted twice: the
 * server answers duplicate:true for the second attempt.
 */
export const PENDING_RUN_KEY = 'tgg-world-pending-run';

const usableStorage = (storage) =>
  storage &&
  typeof storage.getItem === 'function' &&
  typeof storage.setItem === 'function' &&
  typeof storage.removeItem === 'function'
    ? storage
    : null;

/** The queued run, or null when there is none or it is unusable. */
export function readPendingRun(storage) {
  const store = usableStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.runId !== 'string' || parsed.runId.length < 8) return null;
    if (typeof parsed.totalMs !== 'number' || !Number.isFinite(parsed.totalMs) || parsed.totalMs < 0) {
      return null;
    }
    const legs = Array.isArray(parsed.legs)
      ? parsed.legs.filter((leg) => typeof leg === 'number' && Number.isFinite(leg) && leg >= 0)
      : [];
    return {
      runId: parsed.runId,
      totalMs: Math.round(parsed.totalMs),
      legs: legs.map((leg) => Math.round(leg)),
    };
  } catch {
    return null;
  }
}

/** Queues a run for delivery. Never throws: storage can be full or blocked. */
export function writePendingRun(storage, run) {
  const store = usableStorage(storage);
  const runId = run?.runId;
  if (!store || typeof runId !== 'string' || runId.length < 8) return false;
  const totalMs = Number(run.totalMs);
  if (!Number.isFinite(totalMs) || totalMs < 0) return false;
  const legs = Array.isArray(run.legs)
    ? run.legs.filter((leg) => typeof leg === 'number' && Number.isFinite(leg) && leg >= 0)
    : [];
  try {
    store.setItem(
      PENDING_RUN_KEY,
      JSON.stringify({ runId, totalMs: Math.round(totalMs), legs: legs.map((leg) => Math.round(leg)) }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Drops the queued run once the server has it. Passing the id that was just
 * delivered protects a newer queued run from being cleared by a late response.
 */
export function clearPendingRun(storage, runId) {
  const store = usableStorage(storage);
  if (!store) return false;
  try {
    const current = readPendingRun(store);
    if (current && runId && current.runId !== runId) return false;
    store.removeItem(PENDING_RUN_KEY);
    return true;
  } catch {
    return false;
  }
}

/** States worth retrying later; a signed-out player must sign in first. */
export function isRetryable(state) {
  return state === 'unreachable' || state === 'failed';
}

/** Backoff between run-sync attempts, capped at half a minute. */
export const RETRY_DELAYS_MS = [2000, 8000, 30000];

export function retryDelay(attempt) {
  const index = Math.min(Math.max(Math.trunc(Number(attempt) || 0), 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

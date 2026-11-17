// Pure save contract for the TGG World career record.
//
// Nothing here touches the database or the request, so every rule the server
// enforces can be unit-tested without Postgres. The routes own auth and storage.

export const SAVE_VERSION = 2;
export const MAX_CAREER_BYTES = 8192;
export const MAX_DEVICE_ID = 64;
export const MAX_RUNS = 1_000_000;
export const MAX_LEGS = 8;

export interface ClientSave {
  version: number;
  revision: number;
  bestRunMs: number | null;
  runs: number;
  career: Record<string, unknown>;
  deviceId: string | null;
}

export interface StoredSave {
  version: number;
  revision: number;
  bestRunMs: number | null;
  runs: number;
  career: Record<string, unknown>;
  deviceId: string | null;
}

export interface NextSave extends StoredSave {
  changed: boolean;
}

export type ParseResult =
  | { ok: true; value: ClientSave }
  | { ok: false; error: string };

export type ApplyResult =
  | { status: 'applied'; next: NextSave }
  | { status: 'conflict'; storedRevision: number };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integerInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

/**
 * Validates a client save body. Returns the normalised value, or the reason the
 * server should reject it. Never throws, never accepts partial data silently.
 */
export function parseClientSave(input: unknown): ParseResult {
  if (!isPlainObject(input)) return { ok: false, error: 'invalid_body' };

  const version = integerInRange(input.version ?? SAVE_VERSION, 1, SAVE_VERSION);
  if (version === null) return { ok: false, error: 'unsupported_version' };

  const revision = integerInRange(input.revision ?? 0, 0, Number.MAX_SAFE_INTEGER);
  if (revision === null) return { ok: false, error: 'invalid_revision' };

  let bestRunMs: number | null;
  if (input.bestRunMs === undefined || input.bestRunMs === null) {
    bestRunMs = null;
  } else if (typeof input.bestRunMs !== 'number' || !Number.isFinite(input.bestRunMs) || input.bestRunMs < 0) {
    return { ok: false, error: 'invalid_best_run' };
  } else {
    bestRunMs = input.bestRunMs;
  }

  const runs = integerInRange(input.runs ?? 0, 0, MAX_RUNS);
  if (runs === null) return { ok: false, error: 'invalid_runs' };

  const rawCareer = input.career ?? {};
  if (!isPlainObject(rawCareer)) return { ok: false, error: 'invalid_career' };
  let careerJson: string;
  try {
    careerJson = JSON.stringify(rawCareer);
  } catch {
    // Circular or otherwise unserialisable payloads are caller bugs, not 500s.
    return { ok: false, error: 'invalid_career' };
  }
  if (careerJson.length > MAX_CAREER_BYTES) return { ok: false, error: 'career_too_large' };

  let deviceId: string | null = null;
  if (input.deviceId !== undefined && input.deviceId !== null) {
    if (typeof input.deviceId !== 'string') return { ok: false, error: 'invalid_device' };
    if (input.deviceId.length === 0 || input.deviceId.length > MAX_DEVICE_ID) {
      return { ok: false, error: 'invalid_device' };
    }
    deviceId = input.deviceId;
  }

  return { ok: true, value: { version, revision, bestRunMs, runs, career: rawCareer, deviceId } };
}

/**
 * Decides what the stored row becomes. A client that echoes an older revision
 * than the server holds is out of date and must reload instead of overwriting,
 * which is what stops a stale tab from erasing a fresher run.
 */
export function applyClientSave(stored: StoredSave, incoming: ClientSave): ApplyResult {
  if (incoming.revision < stored.revision) {
    return { status: 'conflict', storedRevision: stored.revision };
  }

  const bestRunMs =
    incoming.bestRunMs === null
      ? stored.bestRunMs
      : stored.bestRunMs === null
        ? incoming.bestRunMs
        : Math.min(stored.bestRunMs, incoming.bestRunMs);

  return {
    status: 'applied',
    next: {
      version: SAVE_VERSION,
      revision: stored.revision + 1,
      bestRunMs,
      runs: Math.max(stored.runs, incoming.runs),
      career: incoming.career,
      deviceId: incoming.deviceId ?? stored.deviceId,
      changed: true,
    },
  };
}

export interface RunPayload {
  runId: string;
  totalMs: number;
  legs: number[];
  deviceId: string | null;
}

export type RunParseResult = { ok: true; value: RunPayload } | { ok: false; error: string };

/** A completed run: idempotency key, total time, and the per-leg splits. */
export function parseRun(input: unknown): RunParseResult {
  if (!isPlainObject(input)) return { ok: false, error: 'invalid_body' };

  const runId = input.runId;
  if (typeof runId !== 'string' || runId.length < 8 || runId.length > 64) {
    return { ok: false, error: 'invalid_run_id' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) return { ok: false, error: 'invalid_run_id' };

  const totalMs = input.totalMs;
  if (typeof totalMs !== 'number' || !Number.isFinite(totalMs) || totalMs < 0 || totalMs > 86_400_000) {
    return { ok: false, error: 'invalid_total' };
  }

  const legs = input.legs ?? [];
  if (!Array.isArray(legs) || legs.length > MAX_LEGS) return { ok: false, error: 'invalid_legs' };
  for (const leg of legs) {
    if (typeof leg !== 'number' || !Number.isFinite(leg) || leg < 0 || leg > 86_400_000) {
      return { ok: false, error: 'invalid_legs' };
    }
  }

  let deviceId: string | null = null;
  if (input.deviceId !== undefined && input.deviceId !== null) {
    if (typeof input.deviceId !== 'string' || input.deviceId.length === 0 || input.deviceId.length > MAX_DEVICE_ID) {
      return { ok: false, error: 'invalid_device' };
    }
    deviceId = input.deviceId;
  }

  return { ok: true, value: { runId, totalMs, legs: legs as number[], deviceId } };
}

/** Folds a finished run into the stored save without ever worsening the best. */
export function applyRun(stored: StoredSave, run: Pick<RunPayload, 'totalMs'>): NextSave {
  const bestRunMs =
    stored.bestRunMs === null ? run.totalMs : Math.min(stored.bestRunMs, run.totalMs);
  return {
    version: SAVE_VERSION,
    revision: stored.revision + 1,
    bestRunMs,
    runs: stored.runs + 1,
    career: stored.career,
    deviceId: stored.deviceId,
    changed: bestRunMs !== stored.bestRunMs,
  };
}

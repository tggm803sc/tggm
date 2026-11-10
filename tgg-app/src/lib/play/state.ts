import {
  SCREEN_DEFS,
  STEPS,
  TRACKS,
  type MissionStage,
  type Pattern,
  type PlayState,
  type ScreenId,
  type TrackId,
} from './types';

export const STORAGE_KEY = 'tgg.world.play.v1';
export const BPM = 92;

export const TRACK_LABELS: Record<TrackId, string> = {
  drums: 'Drums',
  bass: 'Bass',
  keys: 'Keys',
  lead: 'Lead',
  fx: 'FX',
};

const MISSION_STAGES: MissionStage[] = [
  'hq',
  'drive-to-studio',
  'produce-master',
  'deliver-to-vault',
  'complete',
];

export function emptyPattern(): Pattern {
  return {
    drums: Array.from({ length: STEPS }, () => false),
    bass: Array.from({ length: STEPS }, () => false),
    keys: Array.from({ length: STEPS }, () => false),
    lead: Array.from({ length: STEPS }, () => false),
    fx: Array.from({ length: STEPS }, () => false),
  };
}

export function starterPattern(): Pattern {
  const pattern = emptyPattern();
  for (const step of [0, 2, 4, 6, 8, 10, 12, 14]) pattern.drums[step] = true;
  for (const step of [0, 3, 6, 8, 11, 14]) pattern.bass[step] = true;
  return pattern;
}

export function initialState(): PlayState {
  return {
    version: 1,
    screenId: 1,
    missionStage: 'hq',
    releaseState: 'draft',
    dataMode: 'DEMO',
    phoneOpen: false,
    isPaused: false,
    driveProgress: 0,
    pattern: starterPattern(),
    deliveries: 0,
    startedAt: Date.now(),
  };
}

export function stepCount(pattern: Pattern): number {
  return TRACKS.reduce((total, track) => total + pattern[track].filter(Boolean).length, 0);
}

export function activeTracks(pattern: Pattern): number {
  return TRACKS.filter((track) => pattern[track].some(Boolean)).length;
}

export function canMaster(pattern: Pattern): boolean {
  return activeTracks(pattern) >= 3 && stepCount(pattern) >= 12;
}

export function masterBlockReason(state: PlayState): string | null {
  if (state.releaseState !== 'draft') return 'This session is already mastered.';
  if (state.missionStage !== 'produce-master') {
    return 'Mastering unlocks after you reach Studio 808.';
  }
  if (activeTracks(state.pattern) < 3) return 'Add a third track before mastering.';
  if (stepCount(state.pattern) < 12) return 'Program at least 12 steps before mastering.';
  return null;
}

export type Action =
  | { type: 'hydrate'; state: PlayState }
  | { type: 'navigate'; screenId: ScreenId }
  | { type: 'pause'; paused: boolean }
  | { type: 'reset' }
  | { type: 'enter-coupe' }
  | { type: 'drive'; progress: number }
  | { type: 'toggle-step'; track: TrackId; step: number }
  | { type: 'clear-pattern' }
  | { type: 'master' }
  | { type: 'send-to-vault' }
  | { type: 'confirm-delivery' };

export function reducer(state: PlayState, action: Action): PlayState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'navigate':
      return {
        ...state,
        screenId: action.screenId,
        phoneOpen: action.screenId === 3,
        isPaused: action.screenId === 10,
      };
    case 'pause':
      return { ...state, isPaused: action.paused };
    case 'reset':
      return initialState();
    case 'enter-coupe':
      if (state.missionStage !== 'hq') return state;
      return { ...state, missionStage: 'drive-to-studio', screenId: 12, phoneOpen: false };
    case 'drive': {
      const progress = Math.min(1, Math.max(0, action.progress));
      if (state.missionStage !== 'drive-to-studio') {
        return { ...state, driveProgress: progress };
      }
      if (progress >= 1) {
        return { ...state, driveProgress: 1, missionStage: 'produce-master' };
      }
      return { ...state, driveProgress: progress };
    }
    case 'toggle-step': {
      const current = state.pattern[action.track];
      if (action.step < 0 || action.step >= STEPS) return state;
      const next = current.map((on, index) => (index === action.step ? !on : on));
      return { ...state, pattern: { ...state.pattern, [action.track]: next } };
    }
    case 'clear-pattern':
      return { ...state, pattern: emptyPattern() };
    case 'master': {
      if (masterBlockReason(state) !== null) return state;
      return { ...state, releaseState: 'mastered', missionStage: 'deliver-to-vault' };
    }
    case 'send-to-vault':
      if (state.missionStage !== 'deliver-to-vault' || state.releaseState !== 'mastered') return state;
      return { ...state, releaseState: 'delivery-pending' };
    case 'confirm-delivery':
      if (state.releaseState !== 'delivery-pending') return state;
      return {
        ...state,
        releaseState: 'released',
        missionStage: 'complete',
        deliveries: state.deliveries + 1,
      };
    default:
      return state;
  }
}

function isScreenId(value: unknown): value is ScreenId {
  return typeof value === 'number' && SCREEN_DEFS.some((screen) => screen.id === value);
}

function isPattern(value: unknown): value is Pattern {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return TRACKS.every((track) => {
    const row = candidate[track];
    return Array.isArray(row) && row.length === STEPS && row.every((cell) => typeof cell === 'boolean');
  });
}

export function loadState(): PlayState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<PlayState>;
    if (candidate.version !== 1) return null;
    if (!isScreenId(candidate.screenId)) return null;
    if (!candidate.missionStage || !MISSION_STAGES.includes(candidate.missionStage)) return null;
    if (!['draft', 'mastered', 'delivery-pending', 'released'].includes(String(candidate.releaseState))) {
      return null;
    }
    if (!isPattern(candidate.pattern)) return null;
    const base = initialState();
    const progress = typeof candidate.driveProgress === 'number' ? candidate.driveProgress : 0;
    return {
      ...base,
      screenId: candidate.screenId,
      missionStage: candidate.missionStage,
      releaseState: candidate.releaseState as PlayState['releaseState'],
      phoneOpen: candidate.phoneOpen === true,
      isPaused: candidate.isPaused === true,
      driveProgress: Math.min(1, Math.max(0, progress)),
      pattern: candidate.pattern,
      deliveries: typeof candidate.deliveries === 'number' ? candidate.deliveries : 0,
      startedAt: typeof candidate.startedAt === 'number' ? candidate.startedAt : base.startedAt,
    };
  } catch {
    return null;
  }
}

export function saveState(state: PlayState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private mode; the run still works in memory.
  }
}

export function clearSavedState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function percent(value: number): string {
  return Math.round(value * 100) + '%';
}

export function screenLabel(id: ScreenId): string {
  const def = SCREEN_DEFS.find((screen) => screen.id === id);
  return def ? String(def.id).padStart(2, '0') + ' · ' + def.name : '—';
}

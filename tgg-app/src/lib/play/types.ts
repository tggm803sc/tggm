export const STEPS = 16;

export const TRACKS = ['drums', 'bass', 'keys', 'lead', 'fx'] as const;
export type TrackId = (typeof TRACKS)[number];
export type Pattern = Record<TrackId, boolean[]>;

export type MissionStage =
  | 'hq'
  | 'drive-to-studio'
  | 'produce-master'
  | 'deliver-to-vault'
  | 'complete';

export type ReleaseState = 'draft' | 'mastered' | 'delivery-pending' | 'released';

export type DataMode = 'DEMO';

export const SCREEN_DEFS = [
  { id: 1, slug: 'title', name: 'Cinematic Title Screen' },
  { id: 2, slug: 'gameplay', name: 'Live Gameplay HUD' },
  { id: 3, slug: 'phone', name: 'In-World TGG Phone' },
  { id: 4, slug: 'mission-center', name: 'Mission Center' },
  { id: 5, slug: 'garage', name: 'Garage & TGG Motors' },
  { id: 6, slug: 'studio-808', name: 'Studio 808' },
  { id: 7, slug: 'vault', name: 'The Vault / Music Career' },
  { id: 8, slug: 'cypher', name: 'Cypher Street Plaza' },
  { id: 9, slug: 'multiplayer', name: 'Multiplayer & Collab' },
  { id: 10, slug: 'pause', name: 'Pause & Settings' },
  { id: 11, slug: 'loading', name: 'Loading & Connection States' },
  { id: 12, slug: 'mobile-hud', name: 'Mobile Gameplay HUD' },
] as const;

export type ScreenId = (typeof SCREEN_DEFS)[number]['id'];
export type ScreenSlug = (typeof SCREEN_DEFS)[number]['slug'];

export interface PlayState {
  version: 1;
  screenId: ScreenId;
  missionStage: MissionStage;
  releaseState: ReleaseState;
  dataMode: DataMode;
  phoneOpen: boolean;
  isPaused: boolean;
  driveProgress: number;
  pattern: Pattern;
  deliveries: number;
  startedAt: number;
}

export interface PlayApi {
  state: PlayState;
  go: (screenId: ScreenId) => void;
  togglePause: (paused: boolean) => void;
  reset: () => void;
  enterCoupe: () => void;
  drive: (progress: number) => void;
  toggleStep: (track: TrackId, step: number) => void;
  clearPattern: () => void;
  master: () => void;
  sendToVault: () => void;
  confirmDelivery: () => void;
}

export function screenDef(id: ScreenId) {
  const def = SCREEN_DEFS.find((s) => s.id === id);
  if (!def) throw new Error('unknown screen id: ' + String(id));
  return def;
}

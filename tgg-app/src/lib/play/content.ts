import type { MissionStage } from './types';

export interface MissionSummary {
  id: string;
  index: number;
  title: string;
  kind: string;
  district: string;
  objectives: string[];
  screens: number[];
}

export const ACT_ONE: MissionSummary[] = [
  {
    id: 'i-01-hq',
    index: 0,
    title: 'Keys to the Coupe',
    kind: 'drive',
    district: 'Harbor Row',
    objectives: [
      'Walk to the TGG HQ loading bay',
      'Enter the sports coupe',
      'Reach the harbor gate checkpoint',
    ],
    screens: [2, 4],
  },
  {
    id: 'i-02-drive-to-studio',
    index: 1,
    title: 'The 808 Run',
    kind: 'drive',
    district: '808 Avenue',
    objectives: [
      'Drive from Harbor Row to 808 Avenue',
      'Park in the Studio 808 bay',
      'Meet Nia Vale at the desk',
    ],
    screens: [2, 3, 4],
  },
  {
    id: 'i-03-produce-master',
    index: 2,
    title: 'Five Tracks, One Master',
    kind: 'produce',
    district: '808 Avenue',
    objectives: [
      'Load a 16-step session',
      'Fill all five tracks',
      'Balance levels without clipping',
      'Confirm the master action',
    ],
    screens: [2, 6],
  },
  {
    id: 'i-04-deliver-to-vault',
    index: 3,
    title: 'Hand It to the Vault',
    kind: 'deliver',
    district: 'Vault District',
    objectives: [
      'Drive the master to the Vault District',
      'Check the release metadata',
      'Confirm delivery at the Vault desk',
    ],
    screens: [2, 7],
  },
  {
    id: 'i-05-complete',
    index: 4,
    title: 'The Sound of the Streets',
    kind: 'story',
    district: 'Vault District',
    objectives: [
      'Confirm the release shows as released',
      'Read the Vault receipt',
      'Return to Harbor Row',
    ],
    screens: [2, 7, 11],
  },
];

export function missionStatus(stage: MissionStage, index: number): 'complete' | 'active' | 'locked' {
  const stageIndex: Record<MissionStage, number> = {
    'hq': 0,
    'drive-to-studio': 1,
    'produce-master': 2,
    'deliver-to-vault': 3,
    'complete': 4,
  };
  const current = stageIndex[stage];
  if (index < current) return 'complete';
  if (index === current) return stage === 'complete' ? 'complete' : 'active';
  return 'locked';
}

export const LATER_ACTS = [
  { act: 2, name: 'Frequency Wars', note: 'Act II is scripted, not part of this slice.' },
  { act: 3, name: 'The Getta Coast', note: 'Act III is scripted, not part of this slice.' },
];

export const COUPE = {
  id: 'vm-coupe-sport',
  name: 'Coupe 808',
  className: 'sport',
  topSpeedKph: 208,
  seats: 2,
  priceCr: 0,
  handling: 'starter grip / light drift',
  note: 'Design target values from the world design data. Not engine telemetry.',
};

export const CREWS = [
  { id: 'tgg-collective', name: 'TGG Collective', stance: 'home', district: 'Harbor Row' },
  { id: 'static-order', name: 'Static Order', stance: 'rival', district: '808 Avenue' },
  { id: 'vault-syndicate', name: 'The Vault Syndicate', stance: 'antagonist', district: 'Vault District' },
  { id: 'salt-kings', name: 'Salt Kings', stance: 'rival', district: 'Salt Flats' },
  { id: 'northline-choir', name: 'Northline Choir', stance: 'ally', district: 'Northline' },
  { id: 'dead-air', name: 'Dead Air', stance: 'neutral', district: 'The Undertow' },
];

export const RADIO = [
  {
    id: 'northline',
    name: 'NORTHLINE 88.8',
    tag: 'community',
    ident: 'Northline 88.8. The city sings whether you listen or not.',
  },
  {
    id: 'static',
    name: 'STATIC 8.08',
    tag: 'pirate',
    ident: 'Eight-oh-eight. If you can hear this, you are already late.',
  },
  {
    id: 'vault',
    name: 'VAULT NETWORK 101.1',
    tag: 'licensed',
    ident: 'The Vault Network. Every master has an owner.',
  },
  {
    id: 'salt',
    name: 'SALT KINGS CHANNEL',
    tag: 'crew',
    ident: 'Salt Kings channel. Long road, no receipts.',
  },
];

export const RELEASE = {
  title: 'Harbour Row — Session 01',
  artist: 'Getta',
  tracks: 5,
  metadata: {
    format: 'WAV 24-bit / 44.1 kHz',
    splits: 'TGG Collective 100% (fictional)',
    isrc: 'DEMO-TGG-0001',
  },
  royaltyNote: 'Royalty figures are nonfinancial demo values. Nothing is withdrawable.',
};

export const SAMPLE_REWARD = {
  xp: 350,
  rep: 80,
  cr: 50000,
  provenance: 'SAMPLE_UI_AUDIT — display only, never granted by a click',
};

export const DRIVE_ROUTE = {
  from: 'Harbor Row',
  to: '808 Avenue',
  distanceKm: 2.4,
  note: 'Distance is a DEMO route length, not a world measurement.',
};

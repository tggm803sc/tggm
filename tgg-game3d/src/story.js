// Offline story beat engine. Deterministic for a seed, so a run can be replayed.
// Canon: campaign "The Sound of the Streets", Act I "Keys to the Coupe".
// Destinations are fixed by the world geometry; the wording and hooks vary.

const HOOKS = [
  'the master is short a hook and the radio slot closes at midnight',
  'a rival label pressed the same sample and it lands first',
  'the studio engineer wants the mix finished before the sun is up',
  'the coupe still has the demo in the deck and the engine is warmed',
  'the vault closes the session file at 4 a.m. sharp',
  'the A&R flies out at dawn and wants a finished master, not a demo',
  'a pirate station is spinning the rough mix and nobody knows who leaked it',
  'the session player bailed and the booth is still booked till morning',
  'the label paid for one night of studio time and nothing more',
];

const COMPLICATIONS = [
  'traffic is heavy and every light is against you',
  'a unit is already circling the block',
  'the walk signal is short and the sidewalks are crowded',
  'the deck is skipping and the coupe needs a steady hand',
  'a delivery truck has the bridge down to one lane',
  'a rival crew is parked outside the studio with the engine running',
];

const STUDIO_LINES = [
  'Studio 808 · session logged (DEMO)',
  'Studio 808 · hook cut, rough mix saved (DEMO)',
  'Studio 808 · console red, take printed (DEMO)',
];

const VAULT_LINES = [
  'The Vault · master delivered (DEMO)',
  'The Vault · file stamped and shelved (DEMO)',
  'The Vault · delivery accepted (DEMO)',
];

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length) % list.length];
}

function clean(value, max = 90) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function localBeats(seed, stage = 0) {
  const rand = mulberry32((seed || 1) + stage * 7919);
  const hook = pick(rand, HOOKS);
  const complication = pick(rand, COMPLICATIONS);
  const studio = pick(rand, STUDIO_LINES);
  const vault = pick(rand, VAULT_LINES);
  const opener = stage > 0 ? 'The master moved on and the night is not over' : hook;

  return {
    source: 'local',
    logline: `${opener} — ${complication}.`,
    beats: [
      { objective: 'Cut the single at Studio 808', line: studio },
      { objective: 'Carry the master to The Vault', line: vault },
    ],
  };
}

export function validateStory(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const logline = clean(payload.logline, 160);
  const rawBeats = Array.isArray(payload.beats) ? payload.beats : [];
  const beats = rawBeats
    .map((beat) => ({
      objective: clean(beat?.objective, 60),
      line: clean(beat?.line, 90),
    }))
    .filter((beat) => beat.objective && beat.line)
    .slice(0, 2);

  if (!logline || beats.length < 2) return null;
  return { source: payload.source === 'remote' ? 'remote' : 'local', logline, beats };
}

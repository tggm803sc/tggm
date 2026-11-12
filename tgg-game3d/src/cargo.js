// The Salt Flats cargo run: load crates into the van, drive them to the contract's
// drop before the clock runs out, and keep the freight intact on the way.
// Pure state only, so the run can be tested without a renderer.

// Dents a day-run contract survives; the night contract overrides it to one.
export const MAX_DAMAGE = 2;

// A contract is not just a payout: it decides how many crates, how much clock and
// which dock the van runs to. `standard` is the original three-crate Vault run;
// `priority` is the heavier Studio 808 run that dispatch opens next.
export const TIERS = {
  standard: {
    name: 'Standard freight',
    crates: 3,
    seconds: 90,
    drop: 'The Vault',
    damage: MAX_DAMAGE,
    reward: { cash: 850, xp: 120 },
  },
  priority: {
    name: 'Priority freight',
    crates: 4,
    seconds: 110,
    drop: 'Studio 808',
    damage: MAX_DAMAGE,
    reward: { cash: 1300, xp: 180 },
  },
  // The tight one: five crates on a 75-second clock. Dispatch also moves the
  // world clock to a night start, so it looks different as well as reading harder.
  night: {
    name: 'Night freight',
    crates: 5,
    seconds: 75,
    drop: 'The Vault',
    // Dark roads: one bad hit ends the run instead of the usual two.
    damage: 1,
    reward: { cash: 1600, xp: 220 },
  },
};

// Dispatch works through the contracts in this order and wraps around.
export const ROTATION = ['standard', 'priority', 'night'];

export const CRATES = TIERS.standard.crates;
export const CARGO_SECONDS = TIERS.standard.seconds;
export const IMPACT_SPEED = 8.5;

export function tierOf(cargo) {
  return cargo && TIERS[cargo.tier] ? cargo.tier : 'standard';
}

export function tierSpec(cargo) {
  return TIERS[tierOf(cargo)];
}

export function crateQuota(cargo) {
  return tierSpec(cargo).crates;
}

// How many dents the contract survives before the freight is written off.
export function damageLimit(cargo) {
  return tierSpec(cargo).damage;
}

export function createCargo(tier = 'standard') {
  return {
    tier: TIERS[tier] ? tier : 'standard',
    state: 'idle', // idle → loading → loaded → transit → delivered | failed
    crates: 0,
    damage: 0,
    startedAt: null,
    deliveredAt: null,
    failedAt: null,
    reason: null,
    attempts: 0,
    leg: 'out', // out = apron → drop, back = drop → apron
    rewarded: false,
  };
}

export function normalizeCargo(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const states = ['idle', 'loading', 'loaded', 'transit', 'delivered', 'failed'];
  const state = states.includes(source.state) ? source.state : 'idle';
  const tier = TIERS[source.tier] ? source.tier : 'standard';
  const quota = TIERS[tier].crates;
  const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
  return {
    tier,
    state,
    crates: Math.max(0, Math.min(quota, Math.floor(Number(source.crates) || 0))),
    damage: Math.max(0, Math.min(MAX_DAMAGE + 1, Math.floor(Number(source.damage) || 0))),
    startedAt: number(source.startedAt),
    deliveredAt: number(source.deliveredAt),
    failedAt: number(source.failedAt),
    reason: source.reason === 'time' || source.reason === 'damage' ? source.reason : null,
    attempts: Math.max(0, Math.floor(Number(source.attempts) || 0)),
    leg: source.leg === 'back' ? 'back' : 'out',
    rewarded: source.rewarded === true,
  };
}

// One press per crate. Filling the quota makes the van ready to roll.
export function loadCrate(cargo) {
  if (cargo.state !== 'idle' && cargo.state !== 'loading') return null;
  const quota = crateQuota(cargo);
  if (cargo.crates >= quota) return null;
  cargo.crates += 1;
  cargo.state = cargo.crates >= quota ? 'loaded' : 'loading';
  return { crate: cargo.crates, crates: quota, ready: cargo.state === 'loaded' };
}

export function depart(cargo, at) {
  if (cargo.state !== 'loaded') return false;
  cargo.state = 'transit';
  cargo.startedAt = Number(at) || 0;
  return true;
}

// A hard hit dents the freight. The contract decides how many dents it survives:
// two on the day runs, a single one on the night shift.
export function damageCargo(cargo) {
  if (cargo.state !== 'transit') return { damage: cargo.damage, failed: false };
  cargo.damage += 1;
  return { damage: cargo.damage, failed: cargo.damage > damageLimit(cargo) };
}

export function remaining(cargo, now) {
  const seconds = tierSpec(cargo).seconds;
  if (cargo.state !== 'transit' || !Number.isFinite(Number(cargo.startedAt))) return seconds;
  // Clamped at both ends: elapsed time restarts with the session, so a start time
  // from a previous session would otherwise hand back more clock than the
  // contract ever had (75s showing as 300s after a refresh).
  return Math.min(seconds, Math.max(0, seconds - (Number(now) - Number(cargo.startedAt))));
}

export function failCargo(cargo, at, reason) {
  if (cargo.state !== 'transit') return false;
  cargo.state = 'failed';
  cargo.failedAt = Number(at) || 0;
  cargo.reason = reason === 'time' ? 'time' : 'damage';
  return true;
}

export function deliverCargo(cargo, at) {
  if (cargo.state !== 'transit') return false;
  cargo.state = 'delivered';
  cargo.deliveredAt = Number(at) || 0;
  cargo.attempts += 1;
  return true;
}

// The outbound run leaves an empty van at the drop. The return leg hauls fresh
// freight back to the airport terminal, so one cargo job is two deliveries.
export function returnLeg(cargo) {
  if (cargo.state !== 'delivered' || cargo.leg === 'back') return false;
  cargo.leg = 'back';
  cargo.state = 'idle';
  cargo.crates = 0;
  cargo.damage = 0;
  cargo.startedAt = null;
  cargo.reason = null;
  return true;
}

// The payout belongs to the completed round trip, not the outbound drop, and it
// is the contract's own rate. Claiming is one-way: the flag is set before the
// caller pays, so a repeated press, a retried interaction or a reload can never
// pay the same trip twice.
export const ROUND_TRIP_REWARD = TIERS.standard.reward;

export function claimRoundTrip(cargo) {
  if (cargo.leg !== 'back' || cargo.state !== 'delivered' || cargo.rewarded) return null;
  cargo.rewarded = true;
  return { ...tierSpec(cargo).reward };
}

// Back to the loading bay with the freight written off. A failed priority run
// reloads as the same contract; the tier is part of the job, not of the attempt.
export function reloadCargo(cargo) {
  return { ...createCargo(tierOf(cargo)), attempts: cargo.attempts };
}

// Dispatch opens the next contract once the last one is finished, alternating the
// two so both routes get run. It hands back a fresh record, so the previous payout
// stays banked in the career ledger and cannot be claimed a second time; a
// finished run that is not reset stays inert.
// Which contract dispatch would hand over next, so the desk can show the offer
// before the player commits to it.
export function nextTier(cargo) {
  if (!cargo) return null;
  const index = ROTATION.indexOf(tierOf(cargo));
  return ROTATION[(index + 1) % ROTATION.length];
}

export function nextRun(cargo) {
  if (!cargo || cargo.state !== 'delivered') return null;
  return { ...createCargo(nextTier(cargo)), attempts: (Number(cargo.attempts) || 0) + 1 };
}

// What a press at the loading bay should actually do. A delivered run has
// nothing left to do there: reloading it would quietly wipe a finished round trip
// and restart the clock, so it is a no-op rather than a reload.
export function bayAction(cargo) {
  if (cargo.state === 'failed') return 'reload';
  if (cargo.state === 'idle' || cargo.state === 'loading') return 'load';
  return 'none';
}

export function cargoActive(cargo) {
  return cargo.state === 'transit';
}

export function cargoLabel(cargo) {
  const spec = tierSpec(cargo);
  const quota = spec.crates;
  const labelPrefix = { priority: 'PRIORITY · ', night: 'NIGHT · ' };
  const prefix = labelPrefix[tierOf(cargo)] ?? '';
  if (cargo.state === 'transit') {
    return `${prefix}CARGO ${cargo.crates}/${quota} · ${cargo.damage}/${damageLimit(cargo)} dents`;
  }
  if (cargo.state === 'loaded') {
    return cargo.leg === 'back'
      ? 'RETURN FREIGHT · drive to Salt Flats'
      : `${prefix}CARGO LOADED · drive to ${spec.drop}`;
  }
  if (cargo.state === 'loading') return `${prefix}LOADING ${cargo.crates}/${quota}`;
  if (cargo.state === 'delivered') {
    return cargo.leg === 'back' ? 'RETURN FREIGHT DELIVERED' : `${prefix}CARGO DELIVERED`;
  }
  if (cargo.state === 'failed') return 'CARGO LOST · reload at Salt Flats';
  // An idle back leg loads at the drop, not at the apron: naming Salt Flats there
  // sent the player to the wrong end of the run.
  if (cargo.leg === 'back') return `${prefix}FREIGHT WAITING · load at ${spec.drop}`;
  return prefix ? `${prefix}CONTRACT · load at Salt Flats` : 'CARGO EMPTY';
}

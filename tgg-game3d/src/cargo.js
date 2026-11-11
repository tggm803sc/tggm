// The Salt Flats cargo run: load three crates into the van, drive them to the
// Vault dock before the clock runs out, and keep the freight intact on the way.
// Pure state only, so the run can be tested without a renderer.
export const CRATES = 3;
export const CARGO_SECONDS = 90;
export const IMPACT_SPEED = 8.5;
export const MAX_DAMAGE = 2;

export function createCargo() {
  return {
    state: 'idle', // idle → loading → loaded → transit → delivered | failed
    crates: 0,
    damage: 0,
    startedAt: null,
    deliveredAt: null,
    failedAt: null,
    reason: null,
    attempts: 0,
  };
}

export function normalizeCargo(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const states = ['idle', 'loading', 'loaded', 'transit', 'delivered', 'failed'];
  const state = states.includes(source.state) ? source.state : 'idle';
  const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
  return {
    state,
    crates: Math.max(0, Math.min(CRATES, Math.floor(Number(source.crates) || 0))),
    damage: Math.max(0, Math.min(MAX_DAMAGE + 1, Math.floor(Number(source.damage) || 0))),
    startedAt: number(source.startedAt),
    deliveredAt: number(source.deliveredAt),
    failedAt: number(source.failedAt),
    reason: source.reason === 'time' || source.reason === 'damage' ? source.reason : null,
    attempts: Math.max(0, Math.floor(Number(source.attempts) || 0)),
  };
}

// One press per crate. The third crate makes the van ready to roll.
export function loadCrate(cargo) {
  if (cargo.state !== 'idle' && cargo.state !== 'loading') return null;
  if (cargo.crates >= CRATES) return null;
  cargo.crates += 1;
  cargo.state = cargo.crates >= CRATES ? 'loaded' : 'loading';
  return { crate: cargo.crates, crates: CRATES, ready: cargo.state === 'loaded' };
}

export function depart(cargo, at) {
  if (cargo.state !== 'loaded') return false;
  cargo.state = 'transit';
  cargo.startedAt = Number(at) || 0;
  return true;
}

// A hard hit dents the freight; three dents and the run is cooked.
export function damageCargo(cargo) {
  if (cargo.state !== 'transit') return { damage: cargo.damage, failed: false };
  cargo.damage += 1;
  return { damage: cargo.damage, failed: cargo.damage > MAX_DAMAGE };
}

export function remaining(cargo, now) {
  if (cargo.state !== 'transit' || !Number.isFinite(Number(cargo.startedAt))) return CARGO_SECONDS;
  return Math.max(0, CARGO_SECONDS - (Number(now) - Number(cargo.startedAt)));
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

// Back to the loading bay with the freight written off.
export function reloadCargo(cargo) {
  return { ...createCargo(), attempts: cargo.attempts };
}

export function cargoActive(cargo) {
  return cargo.state === 'transit';
}

export function cargoLabel(cargo) {
  if (cargo.state === 'transit') return `CARGO ${cargo.crates}/${CRATES} · ${cargo.damage} dents`;
  if (cargo.state === 'loaded') return 'CARGO LOADED · drive to the Vault';
  if (cargo.state === 'loading') return `LOADING ${cargo.crates}/${CRATES}`;
  if (cargo.state === 'delivered') return 'CARGO DELIVERED';
  if (cargo.state === 'failed') return 'CARGO LOST · reload at Salt Flats';
  return 'CARGO EMPTY';
}

// The world clock: one authoritative hour of the day plus the lighting palette
// that follows from it. Pure arithmetic, so sunrise, sunset and the saved hour
// can be tested without a renderer.
const KEY = 'tgg.worldclock.v2';
// v1 could only ever have held the old 22:30 night start, so it is dropped once
// rather than allowed to pin the world to night after the daytime default lands.
const LEGACY_KEY = 'tgg.worldclock.v1';
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Night is the existing neon look; day is a clear sky. Twilight is a separate
// warm palette so sunrise and sunset do not just fade between two cold skies.
const NIGHT = { sky: [4, 6, 10], fog: [4, 6, 10], hemiSky: [51, 72, 107], hemiGround: [6, 8, 11], hemi: 1.2, exposure: 1.3, fogDensity: 0.0038, stars: 1 };
const DAY = { sky: [126, 168, 208], fog: [150, 180, 205], hemiSky: [214, 232, 255], hemiGround: [70, 74, 64], hemi: 1.5, exposure: 1.45, fogDensity: 0.0022, stars: 0 };
const DUSK = { sky: [120, 58, 40], fog: [96, 54, 44], hemiSky: [255, 156, 102], hemiGround: [40, 28, 26], hemi: 1.25, exposure: 1.4, fogDensity: 0.0032, stars: 0.3 };

const channels = ['sky', 'fog', 'hemiSky', 'hemiGround'];
const scalars = ['hemi', 'exposure', 'fogDensity', 'stars'];

function mix(a, b, t) {
  const out = {};
  for (const key of channels) out[key] = a[key].map((value, index) => Math.round(value + (b[key][index] - value) * t));
  for (const key of scalars) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

const hex = (rgb) => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

export function phaseAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 7) return 'sunrise';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'sunset';
  return 'night';
}

export function lookAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  // The sun rises at 06:00, peaks at 12:00 and sets at 18:00.
  const angle = ((h - 6) / 12) * Math.PI;
  const elevation = Math.sin(angle);
  const day = clamp(elevation, 0, 1);
  const warm = clamp(1 - Math.abs(elevation) * 3.5, 0, 1);
  const base = mix(mix(DAY, NIGHT, 1 - day), DUSK, warm * 0.55);
  return {
    hour: h,
    phase: phaseAt(h),
    sky: hex(base.sky),
    fog: hex(base.fog),
    hemiSky: hex(base.hemiSky),
    hemiGround: hex(base.hemiGround),
    hemi: base.hemi,
    exposure: base.exposure,
    fogDensity: base.fogDensity,
    stars: base.stars,
    sunIntensity: day * 2,
    moonIntensity: (1 - day) * 1.7,
    sunX: Math.cos(angle) * 220,
    sunY: elevation * 240,
    sunZ: 90,
    // Street and window lights are on when the sun is down.
    lights: 1 - day,
  };
}

export function createWorldClock({ hour = 9, speed = 1 / 60, storage = null } = {}) {
  let current = ((Number(hour) || 0) % 24 + 24) % 24;
  let rate = clamp(Number(speed) || 0, 0, 2);
  return {
    get hour() {
      return current;
    },
    get speed() {
      return rate;
    },
    get phase() {
      return phaseAt(current);
    },
    setHour(next) {
      current = ((Number(next) || 0) % 24 + 24) % 24;
      return current;
    },
    setSpeed(next) {
      rate = clamp(Number(next) || 0, 0, 2);
      return rate;
    },
    // Speed is in game hours per real second, so 1/60 is a 24-minute day.
    advance(seconds) {
      const delta = Math.max(0, Number(seconds) || 0) * rate;
      current = (current + delta) % 24;
      return current;
    },
    look() {
      return lookAt(current);
    },
    save() {
      if (!storage) return false;
      try {
        storage.setItem(KEY, JSON.stringify({ hour: current, speed: rate }));
        return true;
      } catch {
        return false;
      }
    },
    load() {
      if (!storage) return false;
      try {
        const raw = storage.getItem(KEY);
        if (!raw) {
          try {
            storage.removeItem(LEGACY_KEY);
          } catch {
            // A read-only store simply keeps the stale entry; it is never read.
          }
          return false;
        }
        const parsed = JSON.parse(raw);
        if (!Number.isFinite(parsed?.hour)) return false;
        current = ((parsed.hour % 24) + 24) % 24;
        if (Number.isFinite(parsed.speed)) rate = clamp(parsed.speed, 0, 2);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// The career ledger: money earned, experience banked, contracts run. The rest of
// the game still labels rewards as display-only, so this is the first place a
// number is actually added up. Pure, so payouts can be tested without a renderer.
export const XP_PER_LEVEL = 250;

export function createCareer() {
  return { cash: 0, xp: 0, level: 1, contracts: 0 };
}

export function normalizeCareer(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const num = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0);
  const career = {
    cash: num(source.cash),
    xp: num(source.xp),
    contracts: Math.floor(num(source.contracts)),
  };
  career.level = levelFor(career.xp);
  return career;
}

// Levels come off a square-root curve, so early contracts move fast and later
// ones need more trips rather than a flat step.
export function levelFor(xp) {
  return 1 + Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / XP_PER_LEVEL));
}

export function xpToNextLevel(xp) {
  const level = levelFor(xp);
  return level * level * XP_PER_LEVEL - (Number(xp) || 0);
}

export function awardContract(career, reward) {
  if (!reward) return null;
  const before = levelFor(career.xp);
  career.cash += reward.cash;
  career.xp += reward.xp;
  career.contracts += 1;
  career.level = levelFor(career.xp);
  return { cash: reward.cash, xp: reward.xp, level: career.level, levelUp: career.level > before };
}

export function careerSummary(career) {
  return `$${career.cash} · ${career.xp} XP · level ${career.level} · ${career.contracts} contracts`;
}

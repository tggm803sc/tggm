// Release pipeline guards. The canon chain is
// draft → mastered → delivery-pending → confirmed → released
// and each step here only fires from the state before it, so a repeated call
// cannot hand over, confirm or release the same master twice.

export const CHAIN = ['draft', 'mastered', 'delivery-pending', 'confirmed', 'released'];

// How long the desk checks the master, and how long the confirmed release takes
// to land. Both are game seconds.
export const DELIVERY_PENDING_SECONDS = 3.2;
export const RELEASE_CONFIRM_SECONDS = 4;

export function canHandOver({ releaseState, deliveryState, stage, complete, masterReady }) {
  if (complete || stage !== 1) return { ok: false, reason: 'not-delivery-stage' };
  if (deliveryState !== 'idle') return { ok: false, reason: 'already-in-delivery' };
  if (releaseState !== 'mastered') return { ok: false, reason: 'nothing-mastered' };
  if (!masterReady) return { ok: false, reason: 'mastering-gate' };
  return { ok: true, reason: 'ok' };
}

export function confirmFrom(releaseState) {
  return releaseState === 'delivery-pending' ? 'confirmed' : null;
}

export function releaseFrom(releaseState) {
  return releaseState === 'confirmed' ? 'released' : null;
}

export function stageAfterRelease(stage) {
  return stage + 1;
}

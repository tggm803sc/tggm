// Repeatable city work. A job is a real pickup and a real drop between places
// that already exist in the world; nothing is paid, and a job never touches the
// release chain or Act I.
export const COURIER = {
  id: 'courier',
  title: 'Vault → Studio 808',
  detail: 'Collect the parcel at The Vault desk, then run it to the Studio 808 door.',
  pickup: { x: -156, z: 122 },
  drop: { x: 156, z: -122 },
};

export function createJob() {
  return { state: 'idle', runs: 0 };
}

// Act I has to be finished before the board opens: the courier is post-story work.
export function canStartJob(job, complete) {
  return Boolean(complete) && job?.state === 'idle';
}

export function startJob(job) {
  if (!job || job.state !== 'idle') return false;
  job.state = 'carrying';
  return true;
}

export function completeJob(job) {
  if (!job || job.state !== 'carrying') return false;
  job.state = 'idle';
  job.runs = Math.max(0, Math.floor(Number(job.runs) || 0)) + 1;
  return true;
}

export function cancelJob(job) {
  if (!job || job.state !== 'carrying') return false;
  job.state = 'idle';
  return true;
}

export function normalizeJob(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    state: source.state === 'carrying' ? 'carrying' : 'idle',
    runs: Math.max(0, Math.floor(Number(source.runs) || 0)),
  };
}

export function jobLabel(job) {
  if (!job || job.state !== 'carrying') return `COURIER · ${job?.runs ?? 0} done`;
  return `COURIER · parcel aboard · ${job.runs} done`;
}

// Performance sampling: what the frame actually cost.
//
// Frame time is measured here as wall-clock between animation frames, because that
// is the number a player feels; draw calls and triangles come from the renderer's
// own counters, so they cannot be flattered by a lucky frame.

const DEFAULT_WINDOW = 120;

export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

export function summariseFrames(frames) {
  const values = frames.filter((ms) => ms > 0 && ms < 2000);
  if (!values.length) return { samples: 0, mean: 0, p50: 0, p95: 0, fps: 0 };
  const mean = values.reduce((sum, ms) => sum + ms, 0) / values.length;
  return {
    samples: values.length,
    mean: Number(mean.toFixed(2)),
    p50: Number(percentile(values, 50).toFixed(2)),
    p95: Number(percentile(values, 95).toFixed(2)),
    fps: Number((1000 / mean).toFixed(1)),
  };
}

export function createPerfMonitor({ window = DEFAULT_WINDOW, loadMs = 0 } = {}) {
  const frames = [];
  let last = 0;
  return {
    // Call once per frame with the timestamp the loop received.
    tick(now) {
      if (last) {
        const delta = now - last;
        if (delta > 0) {
          frames.push(delta);
          if (frames.length > window) frames.shift();
        }
      }
      last = now;
    },
    markLoad(ms) {
      loadMs = ms;
    },
    frames: () => [...frames],
    // Snapshot everything a quality decision needs. `renderer.info` is cumulative
    // per frame, so it is read at the end of the frame it describes.
    sample(renderer) {
      const info = renderer?.info ?? {};
      const render = info.render ?? {};
      const memory = info.memory ?? {};
      return {
        drawCalls: render.calls ?? 0,
        triangles: render.triangles ?? 0,
        textures: memory.textures ?? 0,
        geometries: memory.geometries ?? 0,
        programs: info.programs?.length ?? 0,
        frames: summariseFrames(frames),
        loadMs: Number(loadMs.toFixed(0)),
        pixelRatio: renderer?.getPixelRatio ? Number(renderer.getPixelRatio().toFixed(2)) : 0,
      };
    },
    reset() {
      frames.length = 0;
      last = 0;
    },
  };
}

export function formatSample(sample) {
  const parts = [
    `${sample.drawCalls} calls`,
    `${sample.triangles} tris`,
    `${sample.textures} tex`,
    `${sample.frames.fps} fps (p95 ${sample.frames.p95} ms)`,
  ];
  if (sample.loadMs) parts.push(`load ${sample.loadMs} ms`);
  return parts.join(' · ');
}

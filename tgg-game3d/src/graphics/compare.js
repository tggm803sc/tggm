// Screenshot comparison for visual QA.
//
// Two halves: a pure pixel diff (so it can be tested in Node with no canvas), and a
// browser capture path that reads the WebGL canvas at a fixed size and keeps the
// result in localStorage, so a visual regression can be detected without a person
// eyeballing two images.

export const DEFAULT_CAPTURE_WIDTH = 480;

// Sum of per-channel differences over RGBA buffers of the same size.
export function diffPixels(a, b, { threshold = 12 } = {}) {
  if (!a?.length || !b?.length) throw new Error('diffPixels needs two pixel buffers');
  if (a.length !== b.length) {
    throw new Error(`pixel buffers differ in size: ${a.length} vs ${b.length}`);
  }
  const pixels = a.length / 4;
  let total = 0;
  let changed = 0;
  let maxDelta = 0;
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i] - b[i]);
    const dg = Math.abs(a[i + 1] - b[i + 1]);
    const db = Math.abs(a[i + 2] - b[i + 2]);
    const delta = (dr + dg + db) / 3;
    total += delta;
    if (delta > maxDelta) maxDelta = delta;
    if (delta > threshold) changed += 1;
  }
  return {
    meanAbs: Number((total / pixels).toFixed(2)),
    pctChanged: Number(((changed / pixels) * 100).toFixed(2)),
    maxDelta: Math.round(maxDelta),
    pixels,
  };
}

// Reads the canvas immediately after a render. Reading in the same task avoids the
// blank frame that `preserveDrawingBuffer: false` otherwise produces.
export function captureCanvas(renderer, scene, camera, { width = DEFAULT_CAPTURE_WIDTH } = {}) {
  if (!renderer || !scene || !camera) throw new Error('captureCanvas needs renderer, scene and camera');
  renderer.render(scene, camera);
  const source = renderer.domElement;
  const ratio = source.height / source.width;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(1, Math.round(width * ratio));
  const context = canvas.getContext('2d');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export function readPixels(dataURL, { width = DEFAULT_CAPTURE_WIDTH } = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.max(1, Math.round((width * image.height) / image.width));
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      resolve({ data, width: canvas.width, height: canvas.height });
    };
    image.onerror = () => reject(new Error('could not decode the captured image'));
    image.src = dataURL;
  });
}

// Baselines live beside the save rather than in the repository: they are per-device
// evidence (resolution and driver differ), not a fixture.
export function createBaselineStore(storage, prefix = 'tgg-baseline:') {
  return {
    keys() {
      const keys = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(prefix)) keys.push(key.slice(prefix.length));
      }
      return keys.sort();
    },
    save(view, dataURL) {
      storage.setItem(prefix + view, dataURL);
      return dataURL.length;
    },
    load(view) {
      return storage.getItem(prefix + view);
    },
    remove(view) {
      storage.removeItem(prefix + view);
    },
  };
}

// Compares a fresh capture against the stored baseline for the same view.
export async function compareWithBaseline(dataURL, baselineURL, options) {
  const [current, baseline] = await Promise.all([
    readPixels(dataURL, options),
    readPixels(baselineURL, options),
  ]);
  if (current.data.length !== baseline.data.length) {
    throw new Error('baseline was captured at a different size; re-capture it');
  }
  return diffPixels(current.data, baseline.data);
}

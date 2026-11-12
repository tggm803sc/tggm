import { createAssetLibrary, DEFAULT_MANIFEST } from './assets.js';
import { budgetReport, detectDevice, qualityNames, resolveProfile } from './quality.js';
import { createPerfMonitor, formatSample } from './perf.js';
import { captureCanvas, compareWithBaseline, createBaselineStore, DEFAULT_CAPTURE_WIDTH } from './compare.js';
import { LIGHTING_PRESETS, PHOTO_VIEWS, resolveView } from './presets.js';

// TGG Graphics Studio: the face the game, the tests and any future tool talk to.
//
// It owns no rendering of its own. Everything it exposes — quality, assets, perf,
// photo views, before/after comparison — is a documented handle onto systems that
// already exist in main.js, so the studio can be queried in a debug session or by
// an automated check without a second code path building a second world.

export function createGraphicsStudio(context) {
  const {
    renderer,
    scene,
    camera,
    // Applied by main.js, which owns the renderer, sun and district.
    applyQuality,
    worldClock,
    applyWorldLight,
    // Photo mode: main.js yields its follow camera to `config`, or takes it back
    // when the studio releases it.
    setPhoto,
    // Where the game keeps its save, so a quality change survives a reload.
    saveSettings,
    storage = globalThis.localStorage,
    loadMs = 0,
    manifest = DEFAULT_MANIFEST,
  } = context;

  const assets = createAssetLibrary(manifest);
  const perf = createPerfMonitor({ loadMs });
  const baselines = createBaselineStore(storage);
  const state = {
    quality: context.quality ?? 'high',
    photo: null,
    lastCapture: null,
  };

  const profile = () => resolveProfile(state.quality);

  function setQuality(name) {
    const resolved = resolveProfile(name);
    state.quality = resolved.name;
    const applied = applyQuality ? applyQuality(resolved.name) : null;
    saveSettings?.(resolved.name);
    return { profile: resolved, applied };
  }

  // Puts the game into a fixed camera for a comparison shot: sets the hour, places
  // the walker where a view needs one, and hands the camera to main.js.
  function photo(id, { hour } = {}) {
    const view = resolveView(id, { car: context.car?.(), walker: context.walker?.() });
    if (view.place && context.placeWalker) context.placeWalker(view.place);
    const targetHour = hour ?? view.hour;
    worldClock?.setHour(targetHour);
    applyWorldLight?.();
    state.photo = { id: view.id, hour: targetHour, camera: view.camera };
    setPhoto?.(state.photo);
    return { ...state.photo, label: view.label };
  }

  function exitPhoto() {
    state.photo = null;
    setPhoto?.(null);
    return true;
  }

  // Reads the canvas at a fixed width. Called right after a render, so it never
  // returns the blank frame a non-preserved drawing buffer would give.
  function capture({ width = DEFAULT_CAPTURE_WIDTH } = {}) {
    if (!renderer || !scene || !camera) throw new Error('the studio has no renderer to capture');
    const dataURL = captureCanvas(renderer, scene, camera, { width });
    state.lastCapture = { at: Date.now(), width, id: state.photo?.id ?? null };
    return dataURL;
  }

  function saveBaseline(view = state.photo?.id ?? 'default') {
    return { view, bytes: baselines.save(view, capture()) };
  }

  async function compareToBaseline(view = state.photo?.id ?? 'default') {
    const baseline = baselines.load(view);
    if (!baseline) return { view, ok: false, reason: 'no baseline stored for this view' };
    const diff = await compareWithBaseline(capture(), baseline);
    return { view, ok: true, ...diff };
  }

  function report() {
    const sample = perf.sample(renderer);
    const limits = budgetReport(sample, state.quality);
    return {
      profile: profile(),
      quality: state.quality,
      sample,
      budget: limits,
      summary: formatSample(sample),
      assets: assets.export().counts,
      photo: state.photo?.id ?? null,
    };
  }

  return {
    // Quality
    quality: () => profile(),
    qualityNames,
    setQuality,
    detect: () => detectDevice({
      width: globalThis.innerWidth ?? 1280,
      dpr: globalThis.devicePixelRatio ?? 1,
      hardwareConcurrency: globalThis.navigator?.hardwareConcurrency ?? 4,
      deviceMemory: globalThis.navigator?.deviceMemory ?? 4,
      mobile: /Android|iPhone|iPad/i.test(globalThis.navigator?.userAgent ?? ''),
    }),
    qualityReport: () => budgetReport(perf.sample(renderer), state.quality),

    // Assets
    assets,
    manifest: () => assets.export(),
    validateAssets: () => assets.validate(),

    // Performance
    perf,
    tick: (now) => perf.tick(now),
    sample: () => perf.sample(renderer),
    report,
    markLoad: (ms) => perf.markLoad(ms),

    // Views and visual QA
    presets: LIGHTING_PRESETS,
    views: PHOTO_VIEWS.map(({ id, label, hour, subject }) => ({ id, label, hour, subject: subject ?? 'camera' })),
    photo,
    exitPhoto,
    currentPhoto: () => state.photo,
    capture,
    saveBaseline,
    compareToBaseline,
    baselines: () => baselines.keys(),
  };
}

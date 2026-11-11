// The pro studio sheet: a multitrack timeline, a live microphone chain, editing,
// a mixer and WAV export. The model lives in session.js, the audio in mic.js,
// the bytes in wav.js and the durable store in storage.js — this file is the UI
// and the transport wiring, so a broken control cannot hide in the engine.
import { MicEngine, decodeBlob } from './mic.js';
import { storage } from './storage.js';
import { encodeWav, mixdown, stemMixdown } from './wav.js';
import {
  TRACK_KINDS,
  addClip,
  addTake,
  addTrack,
  armTrack,
  armTrack as arm,
  FX_RANGES,
  MASTER_RANGES,
  addAutomationPoint,
  addMasterAutomationPoint,
  addFxAutomationPoint,
  automationAt,
  removeAutomationPoint,
  removeFxAutomationPoint,
  removeMasterAutomationPoint,
  clipGain,
  compSection,
  limitSample,
  masterGain,
  createSession,
  moveClip,
  normalizeSession,
  projectDuration,
  pushHistory,
  redo,
  removeClip,
  removeTrack,
  serializeSession,
  splitClip,
  trimClip,
  undo,
  updateTrack,
} from './session.js';

const el = (id) => document.getElementById(id);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'value') node.value = value;
    else if (key === 'checked') node.checked = Boolean(value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

const FX_CONTROLS = [
  { key: 'eqLow', label: 'EQ low', min: -18, max: 18, step: 1, unit: 'dB' },
  { key: 'eqMid', label: 'EQ mid', min: -18, max: 18, step: 1, unit: 'dB' },
  { key: 'eqHigh', label: 'EQ high', min: -18, max: 18, step: 1, unit: 'dB' },
  { key: 'compThreshold', label: 'Comp thr', min: -60, max: 0, step: 1, unit: 'dB' },
  { key: 'compRatio', label: 'Comp ratio', min: 1, max: 20, step: 0.5, unit: ':1' },
  { key: 'gate', label: 'Gate', min: -80, max: -20, step: 1, unit: 'dB' },
  { key: 'deEss', label: 'De-ess', min: 0, max: 1, step: 0.05, unit: '' },
  { key: 'reverb', label: 'Reverb', min: 0, max: 0.8, step: 0.02, unit: '' },
  { key: 'delay', label: 'Delay', min: 0, max: 0.8, step: 0.02, unit: '' },
  { key: 'saturation', label: 'Saturation', min: 0, max: 1, step: 0.05, unit: '' },
  { key: 'limiter', label: 'Limiter', min: -12, max: 0, step: 0.5, unit: 'dB' },
];

const PRESETS = {
  'Vocal clean': { eqLow: -2, eqMid: 1, eqHigh: 2, compThreshold: -22, compRatio: 3, gate: -58, deEss: 0.35, reverb: 0.14, delay: 0.06, saturation: 0.1, limiter: -1 },
  'Rap tight': { eqLow: -3, eqMid: 3, eqHigh: 1, compThreshold: -26, compRatio: 5, gate: -52, deEss: 0.5, reverb: 0.08, delay: 0.04, saturation: 0.3, limiter: -1 },
  'Pop air': { eqLow: -1, eqMid: 0, eqHigh: 5, compThreshold: -20, compRatio: 2.5, gate: -60, deEss: 0.25, reverb: 0.24, delay: 0.14, saturation: 0.05, limiter: -1 },
  'Lo-fi': { eqLow: 4, eqMid: -4, eqHigh: -10, compThreshold: -30, compRatio: 6, gate: -50, deEss: 0.1, reverb: 0.3, delay: 0.2, saturation: 0.6, limiter: -2 },
};

export function initDaw({ audio, onToast, getBeat } = {}) {
  const sheet = el('daw');
  if (!sheet) return { open() {}, close() {} };

  let session = createSession();
  let selectedTrackId = null;
  let selectedClip = null;
  let playhead = 0;
  let playing = false;
  let playBase = 0;
  let playStartedAt = 0;
  let sources = [];
  let raf = 0;
  let saveTimer = null;
  let zoom = 90; // pixels per second
  let recordingTrackId = null;
  let dragState = null;

  const mic = new MicEngine();
  const samples = new Map(); // takeId -> Float32Array
  const canvas = el('dawCanvas');

  const toast = (text) => onToast?.(text);
  // Status is a single line, so a slow IndexedDB open must not overwrite a newer
  // message (a save that succeeded looked like it never happened).
  let statusAt = 0;
  const status = (text, { onlyIfQuiet = false } = {}) => {
    if (onlyIfQuiet && Date.now() - statusAt < 1200) return;
    statusAt = Date.now();
    const node = el('dawStatus');
    if (node) node.textContent = text;
  };
  const selectedTrack = () => session.tracks.find((track) => track.id === selectedTrackId) ?? null;

  // ---- persistence --------------------------------------------------------

  function autosave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      storage
        .putProject({ id: 'current', session: serializeSession(session) })
        .catch(() => status('Autosave failed · check browser storage'));
    }, 700);
  }

  async function saveProject() {
    try {
      await storage.putProject({ id: 'current', session: serializeSession(session) });
      status('Session saved · takes and mix are on this device');
      toast('Session saved');
    } catch (error) {
      status(`Save failed: ${error.message}`);
    }
  }

  async function loadProject() {
    try {
      const project = await storage.getProject('current');
      if (!project?.session) {
        session = createSession();
        return false;
      }
      session = normalizeSession(project.session);
      for (const take of Object.values(session.takes)) {
        const stored = await storage.getSamples(take.id);
        if (stored?.samples) samples.set(take.id, stored.samples);
      }
      status(`Recovered “${session.name}” · ${session.tracks.length} tracks`, { onlyIfQuiet: true });
      return true;
    } catch {
      session = createSession();
      return false;
    }
  }

  // ---- rendering ----------------------------------------------------------

  function drawTimeline() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || 900;
    const height = 260;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(0, 0, width, height);

    const rowHeight = session.tracks.length ? height / session.tracks.length : height;
    const secondsVisible = width / zoom;

    // Grid: one line per second, brighter per bar.
    for (let second = 0; second <= secondsVisible; second += 1) {
      const x = second * zoom;
      ctx.strokeStyle = second % 4 === 0 ? 'rgba(199,255,0,0.16)' : 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    session.tracks.forEach((track, index) => {
      const top = index * rowHeight;
      ctx.fillStyle = index % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, top, width, rowHeight);

      for (const clip of track.clips) {
        const x = clip.start * zoom;
        const w = Math.max(2, clip.duration * zoom);
        ctx.fillStyle = clip === selectedClip ? 'rgba(199,255,0,0.22)' : 'rgba(127,212,255,0.14)';
        ctx.fillRect(x, top + 2, w, Math.max(6, rowHeight - 4));
        ctx.strokeStyle = clip === selectedClip ? '#c7ff00' : 'rgba(127,212,255,0.7)';
        ctx.strokeRect(x, top + 2, w, Math.max(6, rowHeight - 4));

        const data = samples.get(clip.takeId);
        if (!data && w > 4) {
          // No audio loaded for this take: say so rather than drawing a flat line.
          ctx.fillStyle = 'rgba(255,139,153,0.25)';
          ctx.fillRect(x + 1, top + 3, w - 2, Math.max(4, rowHeight - 6));
          ctx.fillStyle = 'rgba(255,200,210,0.8)';
          ctx.font = '10px ui-monospace, monospace';
          ctx.fillText('no audio loaded', x + 6, top + rowHeight / 2 + 3);
        }
        if (data && w > 4) {
          ctx.strokeStyle = 'rgba(230,245,255,0.75)';
          ctx.beginPath();
          const mid = top + rowHeight / 2;
          const half = Math.max(2, rowHeight / 2 - 6);
          const startSample = Math.floor(clip.offset * (session.takes?.[clip.takeId]?.sampleRate ?? session.sampleRate));
          const endSample = Math.floor((clip.offset + clip.duration) * (session.takes?.[clip.takeId]?.sampleRate ?? session.sampleRate));
          const perPixel = Math.max(1, Math.floor((endSample - startSample) / w));
          for (let px = 0; px < w; px += 1) {
            let min = 0;
            let max = 0;
            const from = startSample + px * perPixel;
            for (let i = 0; i < perPixel; i += 1) {
              const value = data[from + i] ?? 0;
              if (value < min) min = value;
              if (value > max) max = value;
            }
            ctx.moveTo(x + px, mid - max * half);
            ctx.lineTo(x + px, mid - min * half);
          }
          ctx.stroke();
        }
        if (w > 60) {
          ctx.fillStyle = 'rgba(240,248,255,0.85)';
          ctx.font = '11px ui-monospace, monospace';
          ctx.fillText(clip.name ?? 'Clip', x + 6, top + 14);
        }
      }

      if (!track.clips.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(track.arm ? 'ARMED · press Record' : 'empty', 8, top + rowHeight / 2 + 4);
      }
    });

    const x = playhead * zoom;
    ctx.strokeStyle = '#ff5f7a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function renderTracks() {
    const wrap = el('dawTracks');
    if (!wrap) return;
    const rows = session.tracks.map((track) => {
      const isSelected = track.id === selectedTrackId;
      const row = h('div', { class: `daw-track${isSelected ? ' selected' : ''}`, 'data-track': track.id }, [
        h('div', { class: 'daw-track-top' }, [
          h('button', {
            class: `daw-arm${track.arm ? ' on' : ''}`,
            type: 'button',
            'data-act': 'arm',
            title: 'Record arm',
            text: 'R',
          }),
          h('input', {
            class: 'daw-name',
            type: 'text',
            value: track.name,
            'data-act': 'rename',
            'aria-label': 'Track name',
            maxlength: '32',
          }),
          h('button', {
            class: `daw-mini${track.mute ? ' on' : ''}`,
            type: 'button',
            'data-act': 'mute',
            text: 'M',
            'aria-label': `Mute ${track.name}`,
          }),
          h('button', {
            class: `daw-mini${track.solo ? ' solo' : ''}`,
            type: 'button',
            'data-act': 'solo',
            text: 'S',
            'aria-label': `Solo ${track.name}`,
          }),
          h('button', { class: 'daw-mini danger', type: 'button', 'data-act': 'remove', text: '×', 'aria-label': `Remove ${track.name}` }),
        ]),
        h('div', { class: 'daw-track-mix' }, [
          h('label', { class: 'daw-slider' }, [
            h('span', { text: 'Vol' }),
            h('input', { type: 'range', min: '0', max: '1.2', step: '0.01', value: String(track.volume), 'data-act': 'volume' }),
          ]),
          h('label', { class: 'daw-slider' }, [
            h('span', { text: 'Pan' }),
            h('input', { type: 'range', min: '-1', max: '1', step: '0.05', value: String(track.pan), 'data-act': 'pan' }),
          ]),
          h('label', { class: 'daw-slider' }, [
            h('span', { text: 'In' }),
            h(
              'select',
              { 'data-act': 'input', class: 'daw-select' },
              (mic.devices.length ? mic.devices : [{ id: 'default', label: 'Default input' }]).map((device) =>
                h('option', { value: device.id, text: device.label, selected: device.id === track.input ? '' : null }),
              ),
            ),
          ]),
        ]),
      ]);
      return row;
    });
    wrap.replaceChildren(...rows);
    if (!session.tracks.length) {
      wrap.append(h('p', { class: 'fine', text: 'No tracks yet. Add a vocal track to begin.' }));
    }
  }

  function renderFx() {
    const wrap = el('dawFx');
    if (!wrap) return;
    const track = selectedTrack();
    if (!track) {
      wrap.replaceChildren(h('p', { class: 'fine', text: 'Select a track to open its effects rack.' }));
      return;
    }
    const fx = track.fx;
    const rows = FX_CONTROLS.map((control) =>
      h('label', { class: 'daw-fx-row' }, [
        h('span', { text: control.label }),
        h('input', {
          type: 'range',
          min: String(control.min),
          max: String(control.max),
          step: String(control.step),
          value: String(fx[control.key]),
          'data-fx': control.key,
        }),
        h('b', { text: `${Number(fx[control.key]).toFixed(control.step < 1 ? 2 : 0)}${control.unit}` }),
      ]),
    );
    wrap.replaceChildren(
      h('div', { class: 'daw-fx-head' }, [
        h('h3', { text: `${track.name} · effects` }),
        h('label', { class: 'daw-bypass' }, [
          h('input', { type: 'checkbox', 'data-fx': 'bypass', checked: fx.bypass ? 'checked' : null }),
          h('span', { text: 'Bypass' }),
          h('button', {
            class: `daw-mini${fx.enabled ? ' on' : ''}`,
            type: 'button',
            'data-daw': 'fx-on',
            'aria-pressed': String(Boolean(fx.enabled)),
            text: fx.enabled ? 'FX on' : 'FX off',
            title: 'Render this track through the effects chain',
          }),
        ]),
      ]),
      h(
        'div',
        { class: 'daw-presets' },
        Object.keys(PRESETS).map((name) =>
          h('button', { class: 'daw-mini', type: 'button', 'data-preset': name, text: name }),
        ),
      ),
      ...rows,
    );
  }

  // Automation is one lane per track: volume, or pan when the P tab is chosen.
  const laneMode = new Map();
  const FX_PREFIX = 'automationFx:';
  const LANE_LABELS = {
    eqLow: 'EQ low', eqMid: 'EQ mid', eqHigh: 'EQ high',
    compThreshold: 'Comp thr', compRatio: 'Comp ratio', gate: 'Gate',
    saturation: 'Sat', limiter: 'Lim',
  };
  const LANES = [
    ['automation', 'Vol'],
    ['automationPan', 'Pan'],
    ...Object.keys(FX_RANGES).map((param) => [`${FX_PREFIX}${param}`, LANE_LABELS[param] ?? param]),
  ];
  const laneKeyFor = (trackId) => laneMode.get(trackId) ?? 'automation';
  // Master lanes share the track lane drawing and gesture code; the prefix is
  // what routes them to the bus instead of a track.
  const MASTER_PREFIX = 'master:';
  const laneRangeFor = (key) => {
    if (key === 'automationPan') return [-1, 1];
    if (key.startsWith(MASTER_PREFIX)) return MASTER_RANGES[key.slice(MASTER_PREFIX.length)] ?? [0, 1];
    if (key.startsWith(FX_PREFIX)) return FX_RANGES[key.slice(FX_PREFIX.length)] ?? [0, 1.2];
    return [0, 1.2];
  };
  const lanePointsFor = (key, trackId) => {
    if (key.startsWith(MASTER_PREFIX)) return session.masterAutomation?.[key.slice(MASTER_PREFIX.length)] ?? [];
    if (key.startsWith(FX_PREFIX)) return session.automationFx?.[trackId]?.[key.slice(FX_PREFIX.length)] ?? [];
    return session[key]?.[trackId] ?? [];
  };
  const addLanePoint = (key, trackId, time, value, record = true) => {
    if (key.startsWith(MASTER_PREFIX)) {
      return addMasterAutomationPoint(session, key.slice(MASTER_PREFIX.length), time, value, record);
    }
    return key.startsWith(FX_PREFIX)
      ? addFxAutomationPoint(session, trackId, key.slice(FX_PREFIX.length), time, value, record)
      : addAutomationPoint(session, trackId, time, value, { lane: key, ...laneRangeObject(key), record });
  };
  const removeLanePoint = (key, trackId, time, record = true) => {
    if (key.startsWith(MASTER_PREFIX)) {
      return removeMasterAutomationPoint(session, key.slice(MASTER_PREFIX.length), time, record);
    }
    return key.startsWith(FX_PREFIX)
      ? removeFxAutomationPoint(session, trackId, key.slice(FX_PREFIX.length), time, record)
      : removeAutomationPoint(session, trackId, time, key, record);
  };
  function laneRangeObject(key) {
    const [low, high] = laneRangeFor(key);
    return { low, high };
  }

  // Peak of one track at the playhead, read from the real samples so the meter
  // shows content, not decoration.
  function trackPeak(track, at) {
    for (const clip of track.clips) {
      if (at < clip.start || at >= clip.start + clip.duration) continue;
      const data = samples.get(clip.takeId);
      if (!data) return null;
      const index = Math.floor((clip.offset + (at - clip.start)) * session.sampleRate);
      let peak = 0;
      for (let i = index; i < Math.min(data.length, index + 1024); i += 1) {
        const value = Math.abs(data[i]);
        if (value > peak) peak = value;
      }
      return peak * clipGain(session, track) * (clip.gain ?? 1);
    }
    return 0;
  }

  function renderMixer() {
    const wrap = el('dawMixer');
    if (!wrap) return;
    const strips = session.tracks.map((track) =>
      h('div', { class: `daw-strip${track.id === selectedTrackId ? ' selected' : ''}` }, [
        h('span', { class: 'daw-strip-name', text: track.name.slice(0, 10) }),
        h('div', { class: 'daw-strip-meter' }, [h('span', { 'data-meter': track.id })]),
        // The value has to be set after the options exist, or the select falls
        // back to the first option and the dropdown disagrees with the lane.
        (() => {
          const node = h(
            'select',
            {
              class: 'daw-select daw-lane-tabs',
              'data-lane-param': track.id,
              'aria-label': `${track.name} automation lane`,
            },
            LANES.map(([value, label]) => h('option', { value, text: label })),
          );
          node.value = laneKeyFor(track.id);
          return node;
        })(),
        h('canvas', {
          class: 'daw-auto',
          'data-auto': track.id,
          'data-lane-key': laneKeyFor(track.id),
          width: '62',
          height: '22',
          title: 'Automation · drag points, double-click to remove',
        }),
        h('input', {
          class: 'daw-fader',
          type: 'range',
          min: '0',
          max: '1.2',
          step: '0.01',
          value: String(track.volume),
          'data-fader': track.id,
          'aria-label': `${track.name} level`,
        }),
      ]),
    );

    const master = h('div', { class: 'daw-strip master' }, [
      h('span', { class: 'daw-strip-name', text: 'MASTER' }),
      h('div', { class: 'daw-strip-meter' }, [h('span', { 'data-meter': 'master' })]),
      h('canvas', { class: 'daw-scope', 'data-scope': 'master', width: '76', height: '26', title: 'Master analyser' }),
      h('canvas', {
        class: 'daw-auto',
        'data-auto': 'master',
        'data-lane-key': `${MASTER_PREFIX}limiter`,
        width: '62',
        height: '22',
        title: 'Master limiter automation · drag points, double-click to remove',
      }),
      h('canvas', {
        class: 'daw-auto',
        'data-auto': 'master',
        'data-lane-key': `${MASTER_PREFIX}saturation`,
        width: '62',
        height: '22',
        title: 'Master saturation automation · drag points, double-click to remove',
      }),
      h('input', {
        class: 'daw-fader',
        type: 'range',
        min: '0',
        max: '1.5',
        step: '0.01',
        value: String(session.master.gain),
        'data-fader': 'master',
        'aria-label': 'Master level',
      }),
      h('label', { class: 'daw-field' }, [
        h('span', { text: 'Lim' }),
        h('input', {
          type: 'range',
          min: '-12',
          max: '0',
          step: '0.5',
          value: String(session.master.limiter),
          'data-limiter': '1',
          'aria-label': 'Master limiter',
        }),
      ]),
    ]);

    wrap.replaceChildren(...strips, master);
    drawLanes();
  }

  // The lane is drawn from the same points the mixdown reads, so what the line
  // shows is what the export applies.
  function drawLanes() {
    const wrap = el('dawMixer');
    if (!wrap) return;
    const span = Math.max(1, projectDuration(session));
    for (const lane of wrap.querySelectorAll('[data-auto]')) {
      const key = lane.dataset.laneKey;
      const [low, high] = laneRangeFor(key);
      const points = lanePointsFor(key, lane.dataset.auto);
      const g = lane.getContext('2d');
      if (!g) continue;
      const w = lane.width;
      const hgt = lane.height;
      const yOf = (value) => hgt - ((clamp(value, low, high) - low) / (high - low)) * hgt;
      g.clearRect(0, 0, w, hgt);
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.beginPath();
      g.moveTo(0, yOf(low));
      g.lineTo(w, yOf(low));
      g.stroke();
      if (key === 'automationPan') {
        g.strokeStyle = 'rgba(255,255,255,0.2)';
        g.beginPath();
        g.moveTo(0, yOf(0));
        g.lineTo(w, yOf(0));
        g.stroke();
      }
      if (!points.length) continue;
      g.strokeStyle = key === 'automationPan' ? '#7fd4ff' : '#c7ff00';
      g.beginPath();
      for (let x = 0; x <= w; x += 1) {
        const y = yOf(automationAt(points, (x / w) * span, key === 'automationPan' ? 0 : 1));
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = '#eaffb0';
      for (const point of points) {
        g.fillRect((point.time / span) * w - 1.5, yOf(point.value) - 1.5, 3, 3);
      }
    }
  }

  // Live master analyser: real FFT bins from the audio graph, not a fake bounce.
  let scopeAnalyser = null;
  function drawScope() {
    const scope = document.querySelector('[data-scope="master"]');
    if (!scope) return;
    const g = scope.getContext('2d');
    if (!g) return;
    const w = scope.width;
    const hgt = scope.height;
    g.clearRect(0, 0, w, hgt);
    const ctx = ctxForPlayback();
    const master = audio?.master;
    if (!ctx || !master) return;
    if (!scopeAnalyser || scopeAnalyser.context !== ctx) {
      scopeAnalyser = ctx.createAnalyser();
      scopeAnalyser.fftSize = 64;
      scopeAnalyser.smoothingTimeConstant = 0.72;
      try {
        master.connect(scopeAnalyser);
      } catch {
        scopeAnalyser = null;
        return;
      }
    }
    const bins = new Uint8Array(scopeAnalyser.frequencyBinCount);
    scopeAnalyser.getByteFrequencyData(bins);
    const bar = w / bins.length;
    for (let i = 0; i < bins.length; i += 1) {
      const level = bins[i] / 255;
      g.fillStyle = level > 0.9 ? '#ff5f7a' : level > 0.6 ? '#c7ff00' : '#4fd47a';
      g.fillRect(i * bar, hgt - Math.max(1, level * hgt), Math.max(1, bar - 1), Math.max(1, level * hgt));
    }
  }

  function updateMeters() {
    drawScope();
    const masterNode = document.querySelector('[data-meter="master"]');
    let loudest = 0;
    for (const track of session.tracks) {
      const node = document.querySelector(`[data-meter="${track.id}"]`);
      if (!node) continue;
      const peak = trackPeak(track, playhead);
      if (peak === null) {
        node.parentElement?.classList.add('missing');
        node.style.width = '0%';
        continue;
      }
      node.parentElement?.classList.remove('missing');
      const capped = Math.min(1, peak * masterGain(session));
      node.style.width = `${capped * 100}%`;
      node.dataset.hot = capped > 0.95 ? '1' : '0';
      if (peak * masterGain(session) > loudest) loudest = peak * masterGain(session);
    }
    if (masterNode) {
      masterNode.style.width = `${Math.min(1, loudest) * 100}%`;
      masterNode.dataset.hot = loudest > 0.95 ? '1' : '0';
    }
  }

  function render() {
    const title = el('dawTitle');
    if (title) title.textContent = session.name;
    const bpm = el('dawBpm');
    if (bpm) bpm.value = String(session.bpm);
    renderTracks();
    renderMixer();
    renderFx();
    drawTimeline();
    updateMeters();
  }

  // ---- transport ----------------------------------------------------------

  function stopSources() {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    sources = [];
  }

  function ctxForPlayback() {
    if (mic.ctx?.state === 'running') return mic.ctx;
    audio?.start?.();
    return audio?.ctx ?? null;
  }

  function stopPlayback() {
    stopSources();
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    drawTimeline();
  }

  function startPlayback() {
    const ctx = ctxForPlayback();
    if (!ctx) {
      status('No audio context available');
      return;
    }
    stopSources();
    const origin = ctx.currentTime + 0.06;
    const from = playhead;
    for (const track of session.tracks) {
      const gainValue = clipGain(session, track);
      if (gainValue <= 0) continue;
      for (const clip of track.clips) {
        const data = samples.get(clip.takeId);
        if (!data || !data.length) continue;
        const buffer = ctx.createBuffer(1, data.length, session.sampleRate);
        buffer.copyToChannel(data, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = gainValue * (clip.gain ?? 1);
        source.connect(gain);
        gain.connect(ctx.destination);
        const offset = clip.offset + Math.max(0, from - clip.start);
        const when = origin + Math.max(0, clip.start - from);
        const duration = clip.duration - Math.max(0, from - clip.start);
        if (duration <= 0) continue;
        try {
          source.start(when, Math.min(offset, buffer.duration), Math.min(duration, buffer.duration - offset));
          sources.push(source);
        } catch {
          // A clip entirely outside the buffer is simply skipped.
        }
      }
    }
    playing = true;
    playBase = from;
    playStartedAt = performance.now() / 1000;
    const tick = () => {
      if (!playing) return;
      playhead = playBase + (performance.now() / 1000 - playStartedAt);
      drawTimeline();
      raf = requestAnimationFrame(tick);
    };
    tick();
  }

  function setRecordingUi(active) {
    const button = el('dawRec');
    if (button) {
      button.classList.toggle('recording', active);
      button.textContent = active ? '■ Stop' : '● Record';
    }
  }

  async function record() {
    if (mic.recording) {
      await stopRecording();
      return;
    }
    const track = selectedTrack() ?? session.tracks.find((entry) => entry.arm);
    if (!track) {
      toast('Add a vocal track first');
      return;
    }
    if (!track.arm) arm(session, track.id);
    if (!mic.stream) {
      status('Requesting microphone…');
      const result = await mic.connect();
      if (!result.ok) {
        status(result.message);
        toast(result.message);
        return;
      }
      await refreshDevices();
    }
    mic.applyFx(track.fx);
    const countIn = Number(el('dawCountIn')?.value) || 0;
    const punchIn = Number(el('dawPunchIn')?.value) || 0;
    const punchOut = Number(el('dawPunchOut')?.value) || 0;
    if (el('dawBeat')?.checked) {
      const beat = getBeat?.();
      if (beat) audio?.startSequencer?.(beat, null);
    }
    const result = mic.startRecording({
      bus: audio?.master ?? null,
      bpm: session.bpm,
      countInBeats: countIn,
      punchInAt: punchIn,
      punchOutAt: punchOut,
    });
    if (!result.ok) {
      status(result.error);
      toast(result.error);
      return;
    }
    recordingTrackId = track.id;
    setRecordingUi(true);
    status(countIn ? `Count-in ${countIn} beats…` : 'Recording');
  }

  async function stopRecording() {
    const blob = await mic.stopRecording();
    audio?.stopSequencer?.();
    setRecordingUi(false);
    const track = session.tracks.find((entry) => entry.id === recordingTrackId);
    recordingTrackId = null;
    if (!blob || !track) {
      status('Nothing was captured');
      toast('Nothing was captured');
      return;
    }
    const ctx = mic.ctx ?? ctxForPlayback();
    let decoded = null;
    try {
      decoded = await decodeBlob(ctx, blob);
    } catch {
      status('The take could not be decoded by this browser');
      toast('Take could not be decoded');
      return;
    }
    if (!decoded?.samples?.length) {
      status('The take was empty');
      return;
    }
    const takeId = `take_${Date.now().toString(36)}`;
    const bufferKey = `take:${takeId}`;
    samples.set(takeId, decoded.samples);
    const existing = track.clips.filter((clip) => clip.takeId.startsWith('take_')).length;
    addTake(session, {
      id: takeId,
      trackId: track.id,
      name: `Take ${existing + 1}`,
      duration: decoded.duration,
      sampleRate: decoded.sampleRate,
      bufferKey,
    });
    addClip(session, track.id, {
      takeId,
      start: playhead,
      duration: decoded.duration,
      offset: 0,
      name: `Take ${existing + 1}`,
    });
    try {
      await storage.putTake(bufferKey, blob, { trackId: track.id, duration: decoded.duration });
      await storage.putSamples(takeId, decoded.samples, decoded.sampleRate);
    } catch (error) {
      status(`Take recorded but not saved: ${error.message}`);
    }
    autosave();
    render();
    status(`Recorded ${decoded.duration.toFixed(1)}s · ${track.name}`);
    toast(`Take recorded · ${decoded.duration.toFixed(1)}s`);
  }

  // Prints the current beat into the session as real audio, so the instrumental
  // has a waveform and can be mixed with the vocals on the same timeline.
  async function printBeat() {
    const beat = getBeat?.();
    const ctx = ctxForPlayback();
    if (!beat || !ctx) {
      toast('No beat to print');
      return;
    }
    if (!window.MediaRecorder || !audio?.master) {
      toast('Beat printing is not supported in this browser');
      return;
    }
    const dest = ctx.createMediaStreamDestination();
    try {
      audio.master.connect(dest);
    } catch {
      toast('The beat bus is not available');
      return;
    }
    status('Printing the beat…');
    const chunks = [];
    const recorder = new MediaRecorder(dest.stream);
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.start();
    audio.startSequencer(beat, null);
    const bars = 2;
    await new Promise((resolve) =>
      setTimeout(resolve, ((60 / session.bpm) * 4 * bars + 0.4) * 1000),
    );
    await new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.stop();
    });
    audio.stopSequencer?.();
    try {
      audio.master.disconnect(dest);
    } catch {
      // already disconnected
    }
    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (!blob.size) {
      status('The beat did not record');
      toast('The beat did not record');
      return;
    }
    const decoded = await decodeBlob(ctx, blob).catch(() => null);
    if (!decoded?.samples?.length) {
      status('The beat could not be decoded');
      return;
    }
    const track = addTrack(session, 'instrumental', { name: 'Printed beat' });
    const takeId = `take_${Date.now().toString(36)}`;
    samples.set(takeId, decoded.samples);
    addTake(session, {
      id: takeId,
      trackId: track.id,
      name: 'Beat',
      duration: decoded.duration,
      sampleRate: decoded.sampleRate,
    });
    addClip(session, track.id, {
      takeId,
      start: 0,
      duration: decoded.duration,
      offset: 0,
      name: 'Beat',
    });
    try {
      await storage.putTake(`take:${takeId}`, blob, { trackId: track.id, duration: decoded.duration });
      await storage.putSamples(takeId, decoded.samples, decoded.sampleRate);
    } catch (error) {
      status(`Beat printed but not saved: ${error.message}`);
    }
    selectedTrackId = track.id;
    autosave();
    render();
    status(`Beat printed · ${decoded.duration.toFixed(1)}s · waveform ready`);
    toast('Beat printed to the timeline');
  }

  async function refreshDevices() {
    const devices = await mic.listDevices();
    renderTracks();
    return devices;
  }

  // ---- editing ------------------------------------------------------------

  function splitAtPlayhead() {
    if (!selectedClip) {
      toast('Select a clip first');
      return;
    }
    const track = session.tracks.find((entry) => entry.clips.includes(selectedClip));
    if (!track) return;
    const parts = splitClip(session, track.id, selectedClip.id, playhead);
    if (!parts) {
      toast('Move the playhead inside the clip');
      return;
    }
    selectedClip = parts.right;
    autosave();
    render();
  }

  function deleteSelected() {
    if (!selectedClip) {
      toast('Select a clip first');
      return;
    }
    const track = session.tracks.find((entry) => entry.clips.includes(selectedClip));
    if (!track) return;
    removeClip(session, track.id, selectedClip.id);
    selectedClip = null;
    autosave();
    render();
  }

  function compTwoBars() {
    if (!selectedClip) {
      toast('Select the take you want to comp from');
      return;
    }
    const source = session.tracks.find((entry) => entry.clips.includes(selectedClip));
    const target = session.tracks.find((track) => track.id !== source?.id && track.kind !== 'instrumental');
    if (!source || !target) {
      toast('Add a comp track first');
      return;
    }
    const bar = (60 / session.bpm) * 4;
    const piece = compSection(session, {
      fromTrackId: source.id,
      clipId: selectedClip.id,
      targetTrackId: target.id,
      from: playhead,
      to: playhead + bar,
      name: 'Comp',
    });
    if (!piece) {
      toast('That range is outside the clip');
      return;
    }
    autosave();
    render();
    toast(`Comped ${bar.toFixed(2)}s into ${target.name}`);
  }

  // ---- import and export --------------------------------------------------

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function exportMix() {
    if (!session.tracks.some((track) => track.clips.length)) {
      toast('Nothing to export yet');
      return;
    }
    const mix = mixdown(session, (id) => samples.get(id) ?? new Float32Array(0), {
      sampleRate: session.sampleRate,
    });
    const buffer = encodeWav([mix.left, mix.right], session.sampleRate);
    download(new Blob([buffer], { type: 'audio/wav' }), `${session.name || 'tgg-session'}.wav`);
    status(mix.clipped ? 'Exported · the mix peaked above 0 dB' : `Exported ${mix.duration.toFixed(1)}s stereo WAV`);
    toast('WAV exported');
  }

  function exportStems() {
    if (!session.tracks.some((track) => track.clips.length)) {
      toast('Nothing to export yet');
      return;
    }
    const stems = stemMixdown(session, (id) => samples.get(id) ?? new Float32Array(0), {
      sampleRate: session.sampleRate,
    });
    stems.forEach((stem, index) => {
      const buffer = encodeWav([stem.left, stem.right], session.sampleRate);
      setTimeout(() => download(new Blob([buffer], { type: 'audio/wav' }), `${index + 1}-${stem.name || 'stem'}.wav`), index * 300);
    });
    status(`Exported ${stems.length} stems`);
    toast('Stems exported');
  }

  async function importFile(file) {
    if (!file) return;
    const ctx = mic.ctx ?? ctxForPlayback();
    if (!ctx) {
      toast('No audio context for import');
      return;
    }
    try {
      const decoded = await decodeBlob(ctx, file);
      if (!decoded?.samples?.length) throw new Error('empty file');
      const track = addTrack(session, 'instrumental', { name: file.name.replace(/\.[^.]+$/, '').slice(0, 32) });
      const takeId = `take_${Date.now().toString(36)}`;
      samples.set(takeId, decoded.samples);
      addTake(session, {
        id: takeId,
        trackId: track.id,
        name: file.name.slice(0, 40),
        duration: decoded.duration,
        sampleRate: decoded.sampleRate,
      });
      addClip(session, track.id, {
        takeId,
        start: playhead,
        duration: decoded.duration,
        offset: 0,
        name: file.name.slice(0, 24),
      });
      try {
        await storage.putTake(`take:${takeId}`, file, { trackId: track.id, duration: decoded.duration });
        await storage.putSamples(takeId, decoded.samples, decoded.sampleRate);
      } catch {
        status('Imported for this session only · storage refused the file');
      }
      selectedTrackId = track.id;
      autosave();
      render();
      status(`Imported ${file.name} · ${decoded.duration.toFixed(1)}s`);
    } catch (error) {
      status(`Import failed: ${error.message}`);
      toast('That file could not be decoded');
    }
  }

  // ---- meter --------------------------------------------------------------

  let meterRaf = 0;
  function meterTick() {
    if (sheet.classList.contains('hidden')) {
      meterRaf = 0;
      return;
    }
    const bar = el('dawMeterFill');
    if (bar && mic.analyser) {
      mic.update(0.016);
      const { peak, rms } = mic.level();
      bar.style.width = `${clamp(peak, 0, 1) * 100}%`;
      bar.dataset.state = peak > 0.98 ? 'clip' : rms > 0.02 ? 'live' : 'idle';
    }
    if (playing) updateMeters();
    meterRaf = requestAnimationFrame(meterTick);
  }

  function startMeter() {
    if (meterRaf) return;
    meterRaf = requestAnimationFrame(meterTick);
  }

  // ---- events -------------------------------------------------------------

  function bind() {
    const tracks = el('dawTracks');
    tracks?.addEventListener('click', (event) => {
      const row = event.target.closest('[data-track]');
      if (row) {
        selectedTrackId = row.dataset.track;
        renderFx();
        drawTimeline();
      }
      const action = event.target.closest('[data-act]')?.dataset.act;
      const trackId = row?.dataset.track;
      if (!action || !trackId) return;
      if (action === 'arm') {
        armTrack(session, trackId);
        if (selectedTrackId !== trackId) selectedTrackId = trackId;
        render();
      } else if (action === 'mute') {
        const track = session.tracks.find((entry) => entry.id === trackId);
        updateTrack(session, trackId, { mute: !track.mute });
        render();
      } else if (action === 'solo') {
        const track = session.tracks.find((entry) => entry.id === trackId);
        updateTrack(session, trackId, { solo: !track.solo });
        render();
      } else if (action === 'remove') {
        removeTrack(session, trackId);
        if (selectedTrackId === trackId) selectedTrackId = null;
        render();
      }
      autosave();
    });

    tracks?.addEventListener('change', (event) => {
      const row = event.target.closest('[data-track]');
      const action = event.target.closest('[data-act]')?.dataset.act;
      if (!row || !action) return;
      if (action === 'input') {
        updateTrack(session, row.dataset.track, { input: event.target.value });
        autosave();
      } else if (action === 'rename') {
        updateTrack(session, row.dataset.track, { name: event.target.value.slice(0, 40) });
        autosave();
      }
    });

    tracks?.addEventListener('input', (event) => {
      const row = event.target.closest('[data-track]');
      const action = event.target.closest('[data-act]')?.dataset.act;
      if (!row || !action) return;
      const value = Number(event.target.value);
      if (action === 'volume') updateTrack(session, row.dataset.track, { volume: value });
      else if (action === 'pan') updateTrack(session, row.dataset.track, { pan: value });
      autosave();
    });

    el('dawFx')?.addEventListener('input', (event) => {
      const key = event.target.closest('[data-fx]')?.dataset.fx;
      const track = selectedTrack();
      if (!key || !track) return;
      if (key === 'bypass') track.fx.bypass = event.target.checked;
      else track.fx[key] = Number(event.target.value);
      mic.applyFx(track.fx);
      const label = event.target.parentElement?.querySelector('b');
      if (label) {
        const control = FX_CONTROLS.find((entry) => entry.key === key);
        if (control) label.textContent = `${Number(track.fx[key]).toFixed(control.step < 1 ? 2 : 0)}${control.unit}`;
      }
      autosave();
    });

    el('dawFx')?.addEventListener('click', (event) => {
      const preset = event.target.closest('[data-preset]')?.dataset.preset;
      const track = selectedTrack();
      if (!preset || !track) return;
      Object.assign(track.fx, PRESETS[preset], { bypass: false });
      mic.applyFx(track.fx);
      autosave();
      renderFx();
      toast(`${preset} preset loaded`);
    });

    canvas?.addEventListener('pointerdown', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const seconds = x / zoom;
      const rowHeight = session.tracks.length ? canvas.clientHeight / session.tracks.length : canvas.clientHeight;
      const index = Math.floor(y / rowHeight);
      const track = session.tracks[index];
      playhead = Math.max(0, seconds);
      if (track) {
        const hit = track.clips.find((clip) => seconds >= clip.start && seconds <= clip.start + clip.duration);
        selectedTrackId = track.id;
        selectedClip = hit ?? null;
        dragState = hit ? { trackId: track.id, clipId: hit.id, grabOffset: seconds - hit.start, moved: false } : null;
        renderFx();
      }
      drawTimeline();
    });

    canvas?.addEventListener('pointermove', (event) => {
      if (!dragState) return;
      const rect = canvas.getBoundingClientRect();
      const seconds = (event.clientX - rect.left) / zoom;
      const next = Math.max(0, seconds - dragState.grabOffset);
      if (Math.abs(next - (selectedClip?.start ?? next)) > 0.01) dragState.moved = true;
      moveClip(session, dragState.trackId, dragState.clipId, next);
      selectedClip = session.tracks.find((track) => track.id === dragState.trackId)?.clips.find((clip) => clip.id === dragState.clipId) ?? null;
      drawTimeline();
    });

    canvas?.addEventListener('pointerup', () => {
      if (dragState?.moved) autosave();
      dragState = null;
    });

    canvas?.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoom = clamp(zoom * (event.deltaY < 0 ? 1.15 : 0.87), 20, 400);
      drawTimeline();
    }, { passive: false });

    sheet.addEventListener('click', (event) => {
      const action = event.target.closest('[data-daw]')?.dataset.daw;
      if (!action) return;
      if (action === 'play') {
        if (playing) stopPlayback();
        else startPlayback();
        el('dawPlay').textContent = playing ? 'Pause' : 'Play';
      } else if (action === 'stop') {
        stopPlayback();
        playhead = 0;
        el('dawPlay').textContent = 'Play';
        drawTimeline();
      } else if (action === 'record') {
        record();
      } else if (action === 'undo') {
        if (undo(session)) {
          selectedClip = null;
          render();
          // Lanes live in the mixer sheet, which render() does not rebuild.
          renderMixer();
          autosave();
        }
      } else if (action === 'redo') {
        if (redo(session)) {
          selectedClip = null;
          render();
          renderMixer();
          autosave();
        }
      } else if (action === 'save') {
        saveProject();
      } else if (action === 'export') {
        exportMix();
      } else if (action === 'stems') {
        exportStems();
      } else if (action === 'import') {
        el('dawFile')?.click();
      } else if (action === 'fader') {
        // handled by the input listener below
      } else if (action === 'print-beat') {
        printBeat();
      } else if (action === 'split') {
        splitAtPlayhead();
      } else if (action === 'delete') {
        deleteSelected();
      } else if (action === 'comp') {
        compTwoBars();
      } else if (action === 'add-vocal') {
        const track = addTrack(session, 'vocal');
        selectedTrackId = track.id;
        render();
        autosave();
      } else if (action === 'add-double') {
        const track = addTrack(session, 'double');
        selectedTrackId = track.id;
        render();
        autosave();
      } else if (action === 'add-adlib') {
        const track = addTrack(session, 'adlib');
        selectedTrackId = track.id;
        render();
        autosave();
      } else if (action === 'add-bgv') {
        const track = addTrack(session, 'bgv');
        selectedTrackId = track.id;
        render();
        autosave();
      } else if (action === 'add-harmony') {
        const track = addTrack(session, 'harmony');
        selectedTrackId = track.id;
        render();
        autosave();
      } else if (action === 'monitor') {
        const on = !(el('dawMonitor')?.classList.contains('on'));
        mic.setMonitoring(on, 1);
        el('dawMonitor')?.classList.toggle('on', on);
        status(on ? 'Headphone monitoring on · use headphones' : 'Monitoring off');
      } else if (action === 'mic') {
        connectMic();
      } else if (action === 'fx-on') {
        const track = session.tracks.find((entry) => entry.id === selectedTrackId);
        if (track) {
          track.fx = { ...(track.fx ?? {}), enabled: !track.fx?.enabled };
          autosave();
          render();
          status(`FX ${track.fx.enabled ? 'on' : 'off'} · ${track.name}`);
          toast(`FX ${track.fx.enabled ? 'on' : 'off'} for ${track.name}`);
        }
      } else if (action === 'close') {
        close();
      }
    });

    // Mixer faders and the master limiter. Faders mutate in place rather than
    // through updateTrack, so dragging does not fill the undo history.
    sheet.addEventListener('input', (event) => {
      const laneSelect = event.target.closest('[data-lane-param]');
      if (laneSelect) {
        laneMode.set(laneSelect.dataset.laneParam, laneSelect.value);
        renderMixer();
        return;
      }
      const fader = event.target.closest('[data-fader]');
      if (fader) {
        const id = fader.dataset.fader;
        const value = Number(fader.value) || 0;
        if (id === 'master') {
          session.master.gain = clamp(value, 0, 1.5);
        } else {
          const track = session.tracks.find((entry) => entry.id === id);
          if (track) track.volume = clamp(value, 0, 1.2);
        }
        updateMeters();
        autosave();
        return;
      }
      const limiter = event.target.closest('[data-limiter]');
      if (limiter) {
        session.master.limiter = clamp(Number(limiter.value) || -1, -12, 0);
        autosave();
      }
    });

    el('dawName')?.addEventListener('change', (event) => {
      session.name = event.target.value.slice(0, 60) || 'Untitled session';
      render();
      autosave();
    });

    // Automation editing: press adds or grabs a point, drag moves it, double
    // click removes it. The lane tab switches volume or pan without a dialog.
    const laneAt = (lane, event) => {
      const key = lane.dataset.laneKey;
      const [low, high] = laneRangeFor(key);
      const rect = lane.getBoundingClientRect();
      const span = Math.max(1, projectDuration(session));
      const time = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1) * span;
      const ratio = clamp(1 - (event.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
      return { key, trackId: lane.dataset.auto, time, value: low + ratio * (high - low) };
    };
    const nearestIndex = (key, trackId, time) => {
      const span = Math.max(1, projectDuration(session));
      const points = lanePointsFor(key, trackId);
      let best = -1;
      let closest = (8 / 62) * span;
      points.forEach((point, index) => {
        const distance = Math.abs(point.time - time);
        if (distance < closest) {
          closest = distance;
          best = index;
        }
      });
      return best;
    };
    let laneDrag = null;
    el('dawMixer')?.addEventListener('pointerdown', (event) => {
      const tab = event.target.closest('[data-lane]');
      if (tab) {
        laneMode.set(tab.dataset.trackLane, tab.dataset.lane);
        renderMixer();
        return;
      }
      const lane = event.target.closest('[data-auto]');
      if (!lane) return;
      event.preventDefault();
      const at = laneAt(lane, event);
      // One history entry per gesture. A drag would otherwise snapshot on every
      // pointermove and bury the undo stack in intermediate positions.
      pushHistory(session);
      if (nearestIndex(at.key, at.trackId, at.time) < 0) {
        addLanePoint(at.key, at.trackId, at.time, at.value, false);
        renderMixer();
      }
      laneDrag = at;
    });
    window.addEventListener('pointermove', (event) => {
      if (!laneDrag) return;
      const lane = document.querySelector(`[data-auto="${laneDrag.trackId}"][data-lane-key="${laneDrag.key}"]`);
      if (!lane) return;
      const at = laneAt(lane, event);
      removeLanePoint(laneDrag.key, laneDrag.trackId, laneDrag.time, false);
      addLanePoint(at.key, laneDrag.trackId, at.time, at.value, false);
      laneDrag = at;
      drawLanes();
    });
    window.addEventListener('pointerup', () => {
      if (!laneDrag) return;
      laneDrag = null;
      autosave();
      status('Automation updated');
    });
    el('dawMixer')?.addEventListener('dblclick', (event) => {
      const lane = event.target.closest('[data-auto]');
      if (!lane) return;
      const at = laneAt(lane, event);
      const index = nearestIndex(at.key, at.trackId, at.time);
      if (index < 0) return;
      const point = lanePointsFor(at.key, at.trackId)[index];
      removeLanePoint(at.key, at.trackId, point.time);
      autosave();
      renderMixer();
      status('Automation point removed');
    });

    el('dawBpm')?.addEventListener('change', (event) => {
      session.bpm = clamp(Number(event.target.value) || 96, 40, 220);
      render();
      autosave();
    });

    el('dawFile')?.addEventListener('change', (event) => {
      importFile(event.target.files?.[0]);
      event.target.value = '';
    });
  }

  async function connectMic(deviceId) {
    status('Requesting microphone…');
    const result = await mic.connect(deviceId);
    if (!result.ok) {
      status(result.message);
      toast(result.message);
      return false;
    }
    await refreshDevices();
    status(`Microphone ready · ${result.label ?? 'input'} · ${Math.round((mic.ctx?.baseLatency ?? 0) * 1000)} ms`);
    startMeter();
    return true;
  }

  async function open() {
    sheet.classList.remove('hidden');
    if (!mic.stream) status('Microphone not connected · press Mic to record');
    if (!session.tracks.length) {
      const recovered = await loadProject();
      if (!recovered) {
        const vocal = addTrack(session, 'vocal');
        selectedTrackId = vocal.id;
      }
    }
    if (!selectedTrackId) selectedTrackId = session.tracks[0]?.id ?? null;
    render();
    startMeter();
  }

  function close() {
    stopPlayback();
    if (mic.recording) mic.stopRecording();
    mic.setMonitoring(false);
    sheet.classList.add('hidden');
  }

  bind();
  return { open, close, session: () => session, mic };
}

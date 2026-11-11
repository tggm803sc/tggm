// Real microphone capture and the vocal chain. Everything here is an actual
// Web Audio node or a real MediaStream — nothing is simulated, and every method
// reports failure instead of pretending it worked.

const BEAT_FALLBACK = 96;

function makeImpulse(ctx, seconds = 1.8, decay = 2.6) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return impulse;
}

export class MicEngine {
  constructor() {
    this.ctx = null;
    this.stream = null;
    this.source = null;
    this.deviceId = 'default';
    this.devices = [];
    this.error = null;
    this.recording = false;
    this.paused = false;
    this.chunks = [];
    this.recorder = null;
    this.metronomeTimer = null;
  }

  async ensureContext() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error('This browser has no Web Audio support');
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      // A context created outside a gesture starts suspended and records silence.
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  get ready() {
    return Boolean(this.stream && this.ctx && this.ctx.state === 'running');
  }

  async listDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    this.devices = all
      .filter((device) => device.kind === 'audioinput')
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Input ${index + 1}`,
      }));
    return this.devices;
  }

  // Permission denial and a missing device are different failures and are
  // reported as such, because "no mic" and "blocked" need different fixes.
  async connect(deviceId = this.deviceId) {
    this.error = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error = { code: 'unsupported', message: 'This browser cannot record audio' };
      return { ok: false, ...this.error };
    }
    try {
      await this.ensureContext();
      const constraints = {
        audio: {
          ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.disconnect(false);
      this.stream = stream;
      this.deviceId = deviceId;
      this.buildChain();
      this.devices = await this.listDevices();
      return { ok: true, deviceId, label: stream.getAudioTracks()[0]?.label ?? 'Microphone' };
    } catch (error) {
      const name = error?.name ?? 'Error';
      this.error =
        name === 'NotAllowedError'
          ? { code: 'denied', message: 'Microphone permission was denied' }
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? { code: 'missing', message: 'No microphone on that input' }
            : { code: 'failed', message: error?.message ?? 'The microphone did not open' };
      return { ok: false, ...this.error };
    }
  }

  buildChain() {
    const ctx = this.ctx;
    this.source = ctx.createMediaStreamSource(this.stream);
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1;

    // Vocal chain: gate → EQ → de-ess shelf → compressor → saturation → limiter.
    this.gate = ctx.createGain();
    this.gate.gain.value = 1;

    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 180;
    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1100;
    this.eqMid.Q.value = 1.1;
    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 6500;
    this.deEss = ctx.createBiquadFilter();
    this.deEss.type = 'highshelf';
    this.deEss.frequency.value = 7000;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.18;

    this.saturator = ctx.createWaveShaper();
    this.saturator.curve = makeSaturationCurve(0);
    this.saturator.oversample = '2x';

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.1;

    this.vocalOut = ctx.createGain();

    // Reverb and delay run in parallel and return into the vocal bus.
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = makeImpulse(ctx);
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.value = 0.12;
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.28;
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.22;
    this.delayWet = ctx.createGain();
    this.delayWet.gain.value = 0.08;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.monitorGain = ctx.createGain();
    this.monitorGain.gain.value = 0; // headphone monitoring is opt-in
    this.meterBuffer = new Float32Array(this.analyser.fftSize);

    // Input → gate → EQ → de-ess → comp → sat → limiter → vocal bus.
    this.source.connect(this.inputGain);
    this.inputGain.connect(this.gate);
    this.gate.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.deEss);
    this.deEss.connect(this.comp);
    this.comp.connect(this.saturator);
    this.saturator.connect(this.limiter);
    this.limiter.connect(this.vocalOut);

    this.vocalOut.connect(this.analyser);
    this.vocalOut.connect(this.monitorGain);
    this.monitorGain.connect(ctx.destination);
    this.vocalOut.connect(this.convolver);
    this.convolver.connect(this.reverbWet);
    this.reverbWet.connect(ctx.destination);
    this.vocalOut.connect(this.delay);
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.delayWet);
    this.delayWet.connect(ctx.destination);
  }

  applyFx(fx = {}) {
    if (!this.ctx) return;
    const bypass = Boolean(fx.bypass);
    const set = (param, value) => param.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    set(this.eqLow.gain, bypass ? 0 : Number(fx.eqLow) || 0);
    set(this.eqMid.gain, bypass ? 0 : Number(fx.eqMid) || 0);
    set(this.eqHigh.gain, bypass ? 0 : Number(fx.eqHigh) || 0);
    set(this.deEss.gain, bypass ? 0 : -(Number(fx.deEss) || 0) * 9);
    set(this.comp.threshold, bypass ? 0 : Number(fx.compThreshold) ?? -24);
    set(this.comp.ratio, bypass ? 1 : Math.max(1, Number(fx.compRatio) || 3));
    set(this.reverbWet.gain, bypass ? 0 : Number(fx.reverb) || 0);
    set(this.delayWet.gain, bypass ? 0 : Number(fx.delay) || 0);
    set(this.limiter.threshold, bypass ? 0 : Math.min(-1, Number(fx.limiter) || -1));
    this.saturator.curve = makeSaturationCurve(bypass ? 0 : Number(fx.saturation) || 0);
    this.gateThreshold = bypass ? -100 : Number(fx.gate) ?? -60;
  }

  setInputGain(value) {
    if (!this.inputGain) return 0;
    const gain = Math.max(0, Math.min(4, Number(value) || 0));
    this.inputGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.02);
    return gain;
  }

  setMonitoring(on, level = 1) {
    if (!this.monitorGain) return false;
    this.monitorGain.gain.setTargetAtTime(on ? Math.max(0, Math.min(1.5, level)) : 0, this.ctx.currentTime, 0.03);
    return Boolean(on);
  }

  // Peak and RMS of the live input, straight from an AnalyserNode.
  level() {
    if (!this.analyser) return { peak: 0, rms: 0 };
    this.analyser.getFloatTimeDomainData(this.meterBuffer);
    let peak = 0;
    let sum = 0;
    for (const sample of this.meterBuffer) {
      const magnitude = Math.abs(sample);
      if (magnitude > peak) peak = magnitude;
      sum += sample * sample;
    }
    return { peak, rms: Math.sqrt(sum / this.meterBuffer.length) };
  }

  // The analyser drives the gate in real time; call this from a rAF loop.
  update(dt = 0.016) {
    if (!this.analyser || !this.gate) return;
    const { rms } = this.level();
    const db = 20 * Math.log10(Math.max(rms, 1e-6));
    const threshold = this.gateThreshold ?? -60;
    const open = db > threshold;
    const target = open ? 1 : 0;
    const current = this.gate.gain.value;
    // 4 ms attack, 120 ms release: fast enough to keep consonants.
    const coefficient = target > current ? Math.min(1, dt / 0.004) : Math.min(1, dt / 0.12);
    this.gate.gain.value = current + (target - current) * coefficient;
  }

  // ---- metronome and count-in -------------------------------------------

  click(when, accent = false) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1800 : 1200;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.09, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(when);
    osc.stop(when + 0.07);
  }

  metronome(bpm, beats, { onBeat } = {}) {
    this.stopMetronome();
    const beatSeconds = 60 / (Number(bpm) || BEAT_FALLBACK);
    let beat = 0;
    const tick = () => {
      if (beat >= beats) {
        this.stopMetronome();
        return;
      }
      this.click(this.ctx.currentTime + 0.02, beat % 4 === 0);
      onBeat?.(beat);
      beat += 1;
    };
    tick();
    this.metronomeTimer = setInterval(tick, beatSeconds * 1000);
    return beatSeconds;
  }

  stopMetronome() {
    if (this.metronomeTimer) clearInterval(this.metronomeTimer);
    this.metronomeTimer = null;
  }

  // ---- recording ---------------------------------------------------------

  // `bus` is any node carrying the instrumental so the vocal is recorded over
  // the beat. The recorder captures the mix of vocal + bus, which is what a
  // performer hears in their headphones.
  startRecording({ bus = null, bpm = 96, countInBeats = 0, punchInAt = 0, punchOutAt = 0 } = {}) {
    if (!this.ctx || !this.vocalOut) return { ok: false, error: 'microphone not connected' };
    const Recorder = window.MediaRecorder;
    if (!Recorder) return { ok: false, error: 'this browser cannot record' };
    if (this.recording) return { ok: false, error: 'already recording' };

    try {
      this.recordDest = this.ctx.createMediaStreamDestination();
      this.vocalOut.connect(this.recordDest);
      if (bus) bus.connect(this.recordDest);
      this.chunks = [];
      const type = Recorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : Recorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      this.recorder = new Recorder(this.recordDest.stream, type ? { mimeType: type } : undefined);
      this.recorder.ondataavailable = (event) => {
        if (event.data?.size) this.chunks.push(event.data);
      };
    } catch (error) {
      return { ok: false, error: error?.message ?? 'could not start the recorder' };
    }

    const beatSeconds = 60 / (Number(bpm) || BEAT_FALLBACK);
    const begin = () => {
      this.recorder.start(250);
      this.recording = true;
      this.startedAt = this.ctx.currentTime;
      if (punchOutAt > 0) {
        this.punchTimer = setTimeout(() => this.stopRecording(), punchOutAt * 1000);
      }
    };

    this.recording = true;
    this.paused = false;
    if (countInBeats > 0) {
      this.metronome(bpm, countInBeats);
      this.countInTimer = setTimeout(begin, countInBeats * beatSeconds * 1000);
    } else if (punchInAt > 0) {
      this.punchInTimer = setTimeout(begin, punchInAt * 1000);
    } else {
      begin();
    }
    return { ok: true, countIn: countInBeats, punchInAt, punchOutAt };
  }

  pauseRecording() {
    if (!this.recorder || this.recorder.state !== 'recording') return false;
    this.recorder.pause();
    this.paused = true;
    return true;
  }

  resumeRecording() {
    if (!this.recorder || this.recorder.state !== 'paused') return false;
    this.recorder.resume();
    this.paused = false;
    return true;
  }

  stopRecording() {
    this.stopMetronome();
    for (const timer of [this.countInTimer, this.punchInTimer, this.punchTimer]) {
      if (timer) clearTimeout(timer);
    }
    this.countInTimer = null;
    this.punchInTimer = null;
    this.punchTimer = null;
    const recorder = this.recorder;
    this.recording = false;
    this.paused = false;
    if (!recorder) return Promise.resolve(null);
    this.recorder = null;
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        this.chunks = [];
        if (this.recordDest) {
          try {
            this.vocalOut.disconnect(this.recordDest);
          } catch {
            // already disconnected
          }
        }
        this.recordDest = null;
        resolve(blob.size > 0 ? blob : null);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }

  disconnect(closeContext = true) {
    this.stopMetronome();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    try {
      this.source?.disconnect();
    } catch {
      // already gone
    }
    if (closeContext && this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

function makeSaturationCurve(amount) {
  const drive = Math.max(0, Math.min(1, amount)) * 60;
  const samples = 1024;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = drive === 0 ? x : Math.tanh(x * (1 + drive)) / Math.tanh(1 + drive);
  }
  return curve;
}

// Decodes a recorded blob into mono samples for the timeline and the WAV export.
export async function decodeBlob(ctx, blob) {
  const buffer = await blob.arrayBuffer();
  const audio = await ctx.decodeAudioData(buffer.slice(0));
  const mono = new Float32Array(audio.length);
  for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
    const data = audio.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / audio.numberOfChannels;
  }
  return { samples: mono, sampleRate: audio.sampleRate, duration: audio.duration };
}

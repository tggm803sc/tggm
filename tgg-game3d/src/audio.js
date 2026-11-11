import { stepSeconds } from './sequencer.js';

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.muted = false;
  }

  start() {
    if (this.started) {
      this.unlock();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    this.ctx = ctx;
    // Created outside a gesture the context arrives suspended, and every note
    // scheduled into it is silent. Resume immediately and again on demand.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 520;
    this.filter.connect(this.master);

    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.value = 52;

    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';
    this.osc2.frequency.value = 26;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;

    this.osc1.connect(this.gain);
    this.osc2.connect(this.gain);
    this.gain.connect(this.filter);
    this.osc1.start();
    this.osc2.start();

    // Siren: a two-tone saw that stays silent until a unit is active.
    this.siren = ctx.createOscillator();
    this.siren.type = 'sawtooth';
    this.siren.frequency.value = 720;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.siren.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.siren.start();

    // Footsteps: filtered noise bursts, so walking has weight on the street.
    this.stepBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.16), ctx.sampleRate);
    const stepData = this.stepBuffer.getChannelData(0);
    for (let i = 0; i < stepData.length; i += 1) {
      stepData[i] = (Math.random() * 2 - 1) * (1 - i / stepData.length);
    }
    this.stepFilter = ctx.createBiquadFilter();
    this.stepFilter.type = 'bandpass';
    this.stepFilter.frequency.value = 880;
    this.stepFilter.Q.value = 0.7;
    this.stepBus = ctx.createGain();
    this.stepBus.gain.value = 1;
    this.stepFilter.connect(this.stepBus);
    this.stepBus.connect(this.master);
    this.stepTimer = 0;

    this.started = true;
  }

  // Browsers only start audio from a gesture. Call this from any tap or key.
  unlock() {
    if (!this.ctx) this.start();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx.state === 'running';
  }

  get ready() {
    return Boolean(this.ctx && this.ctx.state === 'running');
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  // Records the master bus (beat plus whatever is played over it) so a take is
  // a real recording, not a replay of the pattern.
  startRecording() {
    if (!this.ctx || !this.master) return false;
    const Recorder = window.MediaRecorder;
    if (!Recorder) return false;
    try {
      this.recordStream = this.ctx.createMediaStreamDestination();
      this.master.connect(this.recordStream);
      this.recordChunks = [];
      const type = Recorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      this.recorder = new Recorder(this.recordStream.stream, type ? { mimeType: type } : undefined);
      this.recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) this.recordChunks.push(event.data);
      };
      this.recorder.start();
      return true;
    } catch {
      this.recorder = null;
      return false;
    }
  }

  // Resolves with an object URL for the take, or null when nothing was caught.
  stopRecording() {
    const recorder = this.recorder;
    this.recorder = null;
    if (!recorder) return Promise.resolve(null);
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const chunks = this.recordChunks ?? [];
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (this.recordStream) {
          try {
            this.master.disconnect(this.recordStream);
          } catch {
            // Already disconnected.
          }
        }
        this.recordStream = null;
        this.recordChunks = [];
        resolve(blob.size > 0 ? URL.createObjectURL(blob) : null);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }

  update(speed, throttle) {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const velocity = Math.min(Math.abs(speed), 34);
    const frequency = 48 + velocity * 4.1 + (throttle ? 9 : 0);
    this.osc1.frequency.setTargetAtTime(frequency, now, 0.08);
    this.osc2.frequency.setTargetAtTime(frequency * 0.5, now, 0.08);
    this.filter.frequency.setTargetAtTime(420 + velocity * 26, now, 0.1);
    this.gain.gain.setTargetAtTime(0.04 + (velocity / 34) * 0.065, now, 0.12);
  }

  updateSiren(active, distance, time) {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    if (!active) {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.2);
      return;
    }
    const proximity = Math.max(0, Math.min(1, 1 - distance / 220));
    const tone = Math.floor(time / 0.5) % 2 === 0 ? 700 : 945;
    this.siren.frequency.setTargetAtTime(tone, now, 0.06);
    this.sirenGain.gain.setTargetAtTime(0.012 + proximity * 0.045, now, 0.14);
  }

  updateFootsteps(speed, dt) {
    if (!this.started) return;
    if (Math.abs(speed) < 0.9) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer += dt;
    if (this.stepTimer < 0.38) return;
    this.stepTimer = 0;

    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.stepBuffer;
    const burst = this.ctx.createGain();
    burst.gain.setValueAtTime(0.05 + Math.min(0.05, Math.abs(speed) * 0.008), now);
    burst.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    source.connect(burst);
    burst.connect(this.stepFilter);
    source.start(now);
    source.stop(now + 0.15);
  }

  click(accent = false) {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1560 : 1040;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.05 : 0.028, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  hitTone(score) {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = score >= 100 ? 1320 : score >= 65 ? 990 : 660;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  startRadio(quality = 70) {
    if (!this.started) return;
    this.radioQuality = quality;
    this.radioOn = true;
    this.radioTimer = 0;
    this.radioBeat = 0;
  }

  stopRadio() {
    this.radioOn = false;
  }

  // A procedural demo loop, not the player's recorded audio.
  updateRadio(dt) {
    if (!this.started || !this.radioOn) return;
    this.radioTimer += dt;
    const beat = 60 / 96;
    if (this.radioTimer < beat) return;
    this.radioTimer -= beat;
    this.radioBeat += 1;

    const now = this.ctx.currentTime;
    const kick = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(120, now);
    kick.frequency.exponentialRampToValueAtTime(45, now + 0.12);
    kickGain.gain.setValueAtTime(0.09, now);
    kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    kick.connect(kickGain);
    kickGain.connect(this.master);
    kick.start(now);
    kick.stop(now + 0.2);

    const notes = this.radioQuality >= 80 ? [55, 65.4, 73.4, 82.4] : [55, 55, 61.7, 55];
    const bass = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bass.type = 'sawtooth';
    bass.frequency.value = notes[this.radioBeat % notes.length];
    bassGain.gain.setValueAtTime(0.0001, now);
    bassGain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    bass.connect(bassGain);
    bassGain.connect(this.master);
    bass.start(now);
    bass.stop(now + 0.32);
  }

  // ---- Studio 808 sequencer ------------------------------------------------
  // A lookahead scheduler on the audio clock, so the sixteen steps stay in time
  // even when the render loop is busy. Every voice below is synthesised here:
  // there is no sample download on mobile data.
  startSequencer(pattern, onStep) {
    if (!this.started) this.start();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.stopSequencer();
    this.seqPattern = pattern;
    this.seqOnStep = onStep;
    this.seqStep = 0;
    this.seqNext = this.ctx.currentTime + 0.08;
    this.seqTimer = setInterval(() => this.scheduleSequencer(), 25);
    return true;
  }

  updateSequencerPattern(pattern) {
    this.seqPattern = pattern;
  }

  isSequencerRunning() {
    return Boolean(this.seqTimer);
  }

  stopSequencer() {
    if (this.seqTimer) clearInterval(this.seqTimer);
    this.seqTimer = null;
    this.seqStep = 0;
  }

  scheduleSequencer() {
    if (!this.ctx || !this.seqPattern) return;
    const pattern = this.seqPattern;
    const horizon = this.ctx.currentTime + 0.14;
    let guard = 0;
    while (this.seqNext < horizon && guard < 32) {
      guard += 1;
      const index = this.seqStep % 16;
      this.playStep(pattern, index, this.seqNext);
      this.seqOnStep?.(index);
      this.seqStep += 1;
      this.seqNext += stepSeconds(pattern.bpm);
      if (!pattern.loop && index === 15) {
        this.stopSequencer();
        break;
      }
    }
  }

  playStep(pattern, index, when) {
    const track = (id) => pattern.tracks[id];
    const level = (id) => (track(id).mute ? 0 : track(id).volume);

    const drums = level('drums');
    if (drums > 0 && track('drums').steps[index]) {
      if (index === 4 || index === 12) this.snare(when, drums * 0.5);
      else this.kick(when, drums * 0.9);
    }
    const bass = level('bass');
    if (bass > 0 && track('bass').steps[index]) this.bassNote(when, index, bass);
    const chords = level('chords');
    if (chords > 0 && track('chords').steps[index]) this.chord(when, index, chords);
    const melody = level('melody');
    if (melody > 0 && track('melody').steps[index]) this.pluck(when, index, melody);
    const perc = level('percussion');
    if (perc > 0 && track('percussion').steps[index]) this.shaker(when, perc);
  }

  kick(when, level) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(122, when);
    osc.frequency.exponentialRampToValueAtTime(46, when + 0.12);
    gain.gain.setValueAtTime(0.001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.02, level * 0.22), when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + 0.24);
  }

  noiseBurst(when, level, frequency, length) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.stepBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.9;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.01, level), when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(when);
    source.stop(when + length + 0.02);
  }

  snare(when, level) {
    this.noiseBurst(when, level * 0.5, 1900, 0.13);
    const body = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.value = 190;
    gain.gain.setValueAtTime(Math.max(0.01, level * 0.18), when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
    body.connect(gain);
    gain.connect(this.master);
    body.start(when);
    body.stop(when + 0.12);
  }

  shaker(when, level) {
    this.noiseBurst(when, level * 0.22, 6200, 0.05);
  }

  bassNote(when, index, level) {
    const roots = [55, 55, 61.74, 65.41];
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = roots[index % roots.length] * (index >= 8 ? 2 : 1);
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    gain.gain.setValueAtTime(0.001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.01, level * 0.16), when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.24);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + 0.26);
  }

  pluck(when, index, level) {
    const scale = [220, 246.94, 293.66, 329.63, 392];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = scale[index % scale.length] * (index % 8 >= 4 ? 2 : 1);
    gain.gain.setValueAtTime(0.001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.01, level * 0.12), when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + 0.2);
  }

  chord(when, index, level) {
    const root = index >= 8 ? 146.83 : 130.81;
    for (const ratio of [1, 1.189, 1.498]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = root * ratio;
      gain.gain.setValueAtTime(0.001, when);
      gain.gain.linearRampToValueAtTime(Math.max(0.005, level * 0.05), when + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.5);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(when);
      osc.stop(when + 0.52);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}

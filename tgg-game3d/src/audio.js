export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.muted = false;
  }

  start() {
    if (this.started) {
      this.ctx?.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    this.ctx = ctx;

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

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}

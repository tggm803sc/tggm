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
    const tone = Math.floor(time / 0.42) % 2 === 0 ? 720 : 960;
    this.siren.frequency.setTargetAtTime(tone, now, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.02 + proximity * 0.06, now, 0.12);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}

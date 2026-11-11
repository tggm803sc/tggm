// A recording session: three layers, tapped on the beat at 96 BPM.
// Scores are game feedback only — nothing here claims a real release.

export const LAYERS = ['DRUMS', 'BASS', 'VOCAL'];
const BEAT_SECONDS = 60 / 96;
const HITS_PER_LAYER = 8;

export class StudioSession {
  constructor() {
    this.active = false;
    this.finished = false;
    this.layerIndex = 0;
    this.phase = 0;
    this.beatCount = 0;
    this.hits = [];
    this.scores = [];
    this.quality = 0;
    this.lastScore = null;
    this.lastAccent = false;
  }

  start() {
    this.active = true;
    this.finished = false;
    this.layerIndex = 0;
    this.phase = 0;
    this.beatCount = 0;
    this.hits = [];
    this.scores = [];
    this.quality = 0;
    this.lastScore = null;
  }

  get layer() {
    return LAYERS[Math.min(this.layerIndex, LAYERS.length - 1)];
  }

  get progress() {
    return this.hits.length / HITS_PER_LAYER;
  }

  update(dt) {
    if (!this.active) return;
    this.phase += dt / BEAT_SECONDS;
    const whole = Math.floor(this.phase);
    if (whole !== this.beatCount) {
      this.beatCount = whole;
      this.lastAccent = whole % 4 === 0;
    }
  }

  // Distance from the nearest beat, in milliseconds.
  offsetMs() {
    const nearest = Math.round(this.phase);
    return Math.abs(this.phase - nearest) * BEAT_SECONDS * 1000;
  }

  scoreTap() {
    const offset = this.offsetMs();
    const score = offset <= 110 ? 100 : offset <= 200 ? 65 : 25;
    this.lastScore = { score, offset: Math.round(offset) };
    return this.lastScore;
  }

  tap() {
    if (!this.active) return null;
    const result = this.scoreTap();
    this.hits.push(result.score);

    if (this.hits.length >= HITS_PER_LAYER) {
      const layerScore = Math.round(
        this.hits.reduce((sum, value) => sum + value, 0) / this.hits.length,
      );
      this.scores.push(layerScore);
      this.hits = [];
      this.layerIndex += 1;
      if (this.layerIndex >= LAYERS.length) {
        this.quality = Math.round(
          this.scores.reduce((sum, value) => sum + value, 0) / this.scores.length,
        );
        this.active = false;
        this.finished = true;
      }
    }
    return result;
  }

  reset() {
    this.finished = false;
    this.scores = [];
    this.quality = 0;
    this.layerIndex = 0;
  }
}

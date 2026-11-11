import { localBeats, validateStory } from './story.js';

// The director asks the Worker for model-written beats, and always has the
// offline beat engine to fall back on when no key is configured.
export class StoryDirector {
  constructor(seed = Date.now() % 2147483647) {
    this.seed = seed;
    this.story = localBeats(this.seed, 0);
    this.lastError = null;
  }

  async fetchRemote(seed, stage) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seed, stage }),
        signal: controller.signal,
      });
      if (!response.ok) {
        this.lastError = response.status === 501 ? 'no key' : `http ${response.status}`;
        return null;
      }
      const payload = await response.json();
      return validateStory(payload);
    } catch (error) {
      this.lastError = error?.name === 'AbortError' ? 'timeout' : 'network';
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async requestRun(stage = 0) {
    this.seed = (this.seed * 16807 + 11) % 2147483647;
    const remote = await this.fetchRemote(this.seed, stage);
    this.story = remote ?? localBeats(this.seed, stage);
    return this.story;
  }
}

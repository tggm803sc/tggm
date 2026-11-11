// Durable storage for recordings and projects. Takes are blobs, so they live in
// IndexedDB rather than localStorage: a session with a few vocal takes is far
// past the 5 MB string quota, and a page reload must not lose the audio.
const DB_NAME = 'tgg-studio';
const DB_VERSION = 1;
const TAKES = 'takes';
const PROJECTS = 'projects';
const SAMPLE_KEY = 'take-samples';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('This browser has no IndexedDB'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TAKES)) db.createObjectStore(TAKES);
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed to open'));
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = fn(transaction.objectStore(store));
        transaction.oncomplete = () => resolve(request?.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      }),
  );
}

export const storage = {
  async putTake(key, blob, meta = {}) {
    return run(TAKES, 'readwrite', (store) => store.put({ blob, meta }, key));
  },
  async getTake(key) {
    return run(TAKES, 'readonly', (store) => store.get(key));
  },
  async deleteTake(key) {
    return run(TAKES, 'readwrite', (store) => store.delete(key));
  },
  async putSamples(key, samples, sampleRate) {
    // Float32Array is structured-cloneable, so the decoded waveform survives too.
    return run(TAKES, 'readwrite', (store) => store.put({ samples, sampleRate }, `${SAMPLE_KEY}:${key}`));
  },
  async getSamples(key) {
    return run(TAKES, 'readonly', (store) => store.get(`${SAMPLE_KEY}:${key}`));
  },
  async putProject(project) {
    return run(PROJECTS, 'readwrite', (store) => store.put(project, project.id ?? 'current'));
  },
  async getProject(id = 'current') {
    return run(PROJECTS, 'readonly', (store) => store.get(id));
  },
  async listProjects() {
    return run(PROJECTS, 'readonly', (store) => store.getAll());
  },
  async deleteProject(id = 'current') {
    return run(PROJECTS, 'readwrite', (store) => store.delete(id));
  },
  async estimate() {
    if (!navigator.storage?.estimate) return null;
    return navigator.storage.estimate();
  },
  async persisted() {
    if (!navigator.storage?.persist) return false;
    return navigator.storage.persist();
  },
};

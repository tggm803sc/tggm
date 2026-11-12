'use client';

import { useEffect } from 'react';

const SCRIPT_URL = '/sw.js';
const SCOPE = '/play';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register(SCRIPT_URL, { scope: SCOPE });

        // Earlier builds registered this worker at scope "/", which let its
        // /play offline fallback answer for unrelated routes. Remove any such
        // registration so only the /play-scoped one survives.
        const playScope = new URL(SCOPE, window.location.origin).href;
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => {
            if (registration.scope === playScope) return Promise.resolve(false);
            const worker =
              registration.active ?? registration.waiting ?? registration.installing;
            if (!worker?.scriptURL.endsWith(SCRIPT_URL)) return Promise.resolve(false);
            return registration.unregister();
          }),
        );
      } catch {
        // Registration is optional; the app works without offline support.
      }
    };

    if (document.readyState === 'complete') {
      void register();
      return;
    }

    const onLoad = () => {
      void register();
    };
    window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}

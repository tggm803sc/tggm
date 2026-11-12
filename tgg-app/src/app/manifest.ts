import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TGG World — Act I',
    short_name: 'TGG World',
    description:
      'Touch slice of the TGG World 12-screen loop: coupe, 808 run, Studio 808, Vault delivery. DEMO data, no currency awarded.',
    id: '/play',
    start_url: '/play',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0C0E11',
    theme_color: '#0C0E11',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

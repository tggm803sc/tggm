import type { Metadata, Viewport } from 'next';
import './play.css';
import { PlayClient } from '@/components/play/PlayClient';

export const metadata: Metadata = {
  title: 'TGG World — Act I playable slice',
  description:
    'Touch slice of the TGG World 12-screen loop: coupe, 808 run, Studio 808, Vault delivery. DEMO data, no currency awarded.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0C0E11',
};

export default function PlayPage() {
  return <PlayClient />;
}

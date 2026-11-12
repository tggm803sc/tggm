import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PlayClient } from '@/components/play/PlayClient';
import '@/app/play/play.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(
  <StrictMode>
    <PlayClient />
  </StrictMode>,
);

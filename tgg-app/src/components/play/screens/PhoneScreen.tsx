'use client';

import { useState } from 'react';
import { Badge, Btn, Panel, ScreenHead } from '@/components/play/ui';
import { RADIO } from '@/lib/play/content';
import type { PlayApi, ScreenId } from '@/lib/play/types';

const APPS: { id: ScreenId; label: string; note: string }[] = [
  { id: 4, label: 'Missions', note: 'Act I dossier' },
  { id: 5, label: 'Garage', note: 'Coupe 808' },
  { id: 6, label: 'Studio 808', note: '16-step session' },
  { id: 7, label: 'The Vault', note: 'Release state' },
  { id: 8, label: 'Cypher', note: 'Act II bracket' },
  { id: 9, label: 'Crew', note: 'Roster' },
  { id: 11, label: 'Sync', note: 'Connection states' },
  { id: 2, label: 'Back to city', note: 'Close the phone' },
];

export function PhoneScreen({ api }: { api: PlayApi }) {
  const [stationId, setStationId] = useState(RADIO[0].id);
  const station = RADIO.find((item) => item.id === stationId) ?? RADIO[0];

  return (
    <div className="tgg-screen">
      <ScreenHead
        id="03"
        title="In-World TGG Phone"
        subtitle="App drawer · GPS · radio"
        onBack={() => api.go(2)}
      />

      <Panel title="Apps" subtitle="Eight tiles, one state object" tag={<Badge>DEMO</Badge>}>
        <div className="tgg-phone-grid">
          {APPS.map((app) => (
            <button key={app.label} type="button" className="tgg-app-tile" onClick={() => api.go(app.id)}>
              <span className="tgg-app-icon" aria-hidden="true">{app.label.slice(0, 2).toUpperCase()}</span>
              <strong>{app.label}</strong>
              <span className="tgg-dim">{app.note}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Radio" subtitle="Idents only · no audio stream is configured" tag={<Badge tone="sim">OFFLINE</Badge>}>
        <div className="tgg-chips">
          {RADIO.map((item) => (
            <Btn
              key={item.id}
              variant={item.id === stationId ? 'primary' : 'default'}
              onClick={() => setStationId(item.id)}
            >
              {item.name}
            </Btn>
          ))}
        </div>
        <p className="tgg-quote">“{station.ident}”</p>
        <p className="tgg-footnote">
          Station copy is scripted flavour. No stream, jingle or voice-over is loaded in this build.
        </p>
      </Panel>
    </div>
  );
}

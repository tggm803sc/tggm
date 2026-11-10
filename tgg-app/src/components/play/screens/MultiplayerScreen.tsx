'use client';

import { Badge, Btn, KeyValue, Panel, ScreenHead } from '@/components/play/ui';
import { CREWS } from '@/lib/play/content';
import type { PlayApi } from '@/lib/play/types';

const STANCE_TONE = {
  home: 'ok',
  ally: 'ok',
  rival: 'warn',
  antagonist: 'warn',
  neutral: 'sim',
} as const;

export function MultiplayerScreen({ api }: { api: PlayApi }) {
  return (
    <div className="tgg-screen">
      <ScreenHead
        id="09"
        title="Multiplayer & Collab"
        subtitle="Lobby · crew roster · relay diagnostics"
        onBack={() => api.go(2)}
      />

      <Panel title="Crews" subtitle="Six crews from the world design data" tag={<Badge tone="sim">NO LIVE SESSION</Badge>}>
        <ul className="tgg-plain-list">
          {CREWS.map((crew) => (
            <li key={crew.id}>
              <strong>{crew.name}</strong>
              <span className="tgg-dim">
                {crew.district} · <Badge tone={STANCE_TONE[crew.stance as keyof typeof STANCE_TONE] ?? 'sim'}>{crew.stance}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Relay diagnostics" subtitle="Nothing here is measured" tag={<Badge tone="sim">SIMULATED</Badge>}>
        <div className="tgg-kv-list">
          <KeyValue label="Ping" value={<span className="tgg-mono">— ms</span>} />
          <KeyValue label="Jitter" value={<span className="tgg-mono">— ms</span>} />
          <KeyValue label="Presence" value="simulated" />
          <KeyValue label="Voice relay" value="not connected" />
        </div>
        <p className="tgg-footnote">
          No transport is open. Ping, jitter and presence stay blank instead of showing invented numbers.
        </p>
        <div className="tgg-row">
          <Btn onClick={() => api.go(3)}>Open phone</Btn>
          <Btn variant="ghost" onClick={() => api.go(11)}>Connection states</Btn>
        </div>
      </Panel>
    </div>
  );
}

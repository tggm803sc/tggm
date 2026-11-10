'use client';

import { Badge, Btn, KeyValue, Panel, ScreenHead } from '@/components/play/ui';
import { ACT_ONE, missionStatus } from '@/lib/play/content';
import { percent } from '@/lib/play/state';
import type { PlayApi, ScreenId } from '@/lib/play/types';

const QUICK_LINKS: { id: ScreenId; label: string }[] = [
  { id: 3, label: 'Phone' },
  { id: 4, label: 'Missions' },
  { id: 5, label: 'Garage' },
  { id: 6, label: 'Studio 808' },
  { id: 7, label: 'The Vault' },
  { id: 8, label: 'Cypher' },
  { id: 9, label: 'Crew' },
];

export function GameplayHud({ api }: { api: PlayApi }) {
  const active = ACT_ONE.find((mission) => missionStatus(api.state.missionStage, mission.index) === 'active');

  return (
    <div className="tgg-screen">
      <ScreenHead
        id="02"
        title="Live Gameplay HUD"
        subtitle="World viewport shell · radar · mission tracker · vehicle telemetry"
        onBack={() => api.go(1)}
      />

      <div className="tgg-grid tgg-grid-2">
        <Panel title="Cordell" subtitle="Harbor Row → Vault District" tag={<Badge tone="sim">SIM</Badge>}>
          <div className="tgg-radar" aria-label="Simulated district radar">
            <span className="tgg-radar-ring" />
            <span className="tgg-radar-cross" />
            <span className="tgg-radar-dot" />
            <span className="tgg-radar-caption">RADAR SIMULATED · NO LIVE POSITION</span>
          </div>
          <div className="tgg-kv-list">
            <KeyValue label="Speed" value={<span className="tgg-mono">— km/h</span>} />
            <KeyValue label="Gear" value={<span className="tgg-mono">—</span>} />
            <KeyValue label="Route" value={api.state.missionStage === 'drive-to-studio' ? percent(api.state.driveProgress) + ' complete' : 'parked'} />
          </div>
        </Panel>

        <Panel
          title={active ? active.title : 'Run complete'}
          subtitle={active ? active.id + ' · ' + active.district : 'Act I finished in this session'}
          tag={<Badge tone="ok">{api.state.missionStage}</Badge>}
        >
          {active ? (
            <ol className="tgg-objectives">
              {active.objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ol>
          ) : (
            <p className="tgg-dim">
              The release shows as released and the Vault receipt is readable. Act II is scripted but not part of this slice.
            </p>
          )}
          <div className="tgg-row">
            {api.state.missionStage === 'hq' ? (
              <Btn variant="primary" onClick={api.enterCoupe}>Enter the coupe</Btn>
            ) : null}
            {api.state.missionStage === 'drive-to-studio' ? (
              <Btn variant="primary" onClick={() => api.go(12)}>Open mobile HUD</Btn>
            ) : null}
            {api.state.missionStage === 'produce-master' ? (
              <Btn variant="primary" onClick={() => api.go(6)}>Open Studio 808</Btn>
            ) : null}
            {api.state.missionStage === 'deliver-to-vault' ? (
              <Btn variant="primary" onClick={() => api.go(7)}>Open The Vault</Btn>
            ) : null}
            <Btn onClick={() => api.go(4)}>Mission center</Btn>
          </div>
        </Panel>
      </div>

      <Panel title="Quick access" subtitle="Every screen keeps the same state">
        <div className="tgg-chips">
          {QUICK_LINKS.map((link) => (
            <Btn key={link.id} onClick={() => api.go(link.id)}>{link.label}</Btn>
          ))}
          <Btn variant="ghost" onClick={() => api.go(10)}>Pause</Btn>
        </div>
      </Panel>
    </div>
  );
}

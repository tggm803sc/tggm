'use client';

import { Badge, Btn, Panel, ScreenHead } from '@/components/play/ui';
import { ACT_ONE, LATER_ACTS, missionStatus } from '@/lib/play/content';
import type { MissionStage, PlayApi } from '@/lib/play/types';

const ACTION_BY_STAGE: Record<MissionStage, { label: string; screen: 2 | 6 | 7 | 12 }> = {
  'hq': { label: 'Enter the coupe', screen: 2 },
  'drive-to-studio': { label: 'Open mobile HUD', screen: 12 },
  'produce-master': { label: 'Open Studio 808', screen: 6 },
  'deliver-to-vault': { label: 'Open The Vault', screen: 7 },
  'complete': { label: 'Read the Vault receipt', screen: 7 },
};

export function MissionCenter({ api }: { api: PlayApi }) {
  const action = ACTION_BY_STAGE[api.state.missionStage];

  return (
    <div className="tgg-screen">
      <ScreenHead
        id="04"
        title="Mission Center"
        subtitle="The Sound of the Streets · Act I"
        onBack={() => api.go(2)}
      />

      <Panel
        title="Act I"
        subtitle="First record, first name, first receipt."
        tag={<Badge tone="ok">{api.state.missionStage}</Badge>}
      >
        <ol className="tgg-mission-list">
          {ACT_ONE.map((mission) => {
            const status = missionStatus(api.state.missionStage, mission.index);
            return (
              <li key={mission.id} className={'tgg-mission tgg-mission-' + status}>
                <div className="tgg-mission-head">
                  <span className="tgg-mono tgg-dim">{String(mission.index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{mission.title}</strong>
                    <p className="tgg-dim">
                      <span className="tgg-mono">{mission.id}</span> · {mission.district} · {mission.kind}
                    </p>
                  </div>
                  <span className={'tgg-status tgg-status-' + status}>{status.toUpperCase()}</span>
                </div>
                {status === 'active' ? (
                  <ul className="tgg-objectives">
                    {mission.objectives.map((objective) => (
                      <li key={objective}>{objective}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div className="tgg-row">
          <Btn variant="primary" onClick={() => api.go(action.screen)}>{action.label}</Btn>
          <Btn variant="ghost" onClick={() => api.go(3)}>Phone</Btn>
        </div>
      </Panel>

      <Panel title="Later acts" subtitle="Written, not implemented in this slice" tag={<Badge tone="warn">LOCKED</Badge>}>
        <ul className="tgg-plain-list">
          {LATER_ACTS.map((act) => (
            <li key={act.act}>
              <strong>Act {act.act} · {act.name}</strong>
              <span className="tgg-dim">{act.note}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

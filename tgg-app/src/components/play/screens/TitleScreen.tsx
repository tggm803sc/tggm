'use client';

import { Badge, Btn } from '@/components/play/ui';
import type { PlayApi } from '@/lib/play/types';

export function TitleScreen({ api }: { api: PlayApi }) {
  const inProgress = api.state.missionStage !== 'hq' || api.state.deliveries > 0;

  return (
    <div className="tgg-title">
      <p className="tgg-kicker">TGG WORLD · ACT I</p>
      <h1 className="tgg-wordmark">TRU GO GETTA</h1>
      <p className="tgg-lede">The Sound of the Streets</p>
      <p className="tgg-dim tgg-title-copy">
        Cordell runs on sound. One borrowed coupe, one 16-step session, one Vault receipt.
      </p>

      <div className="tgg-stack">
        <Btn variant="primary" wide onClick={() => api.go(2)}>
          {inProgress ? 'Continue' : 'Start the run'}
        </Btn>
        <Btn wide onClick={() => api.go(4)}>Mission dossier</Btn>
        <Btn wide variant="ghost" onClick={() => api.go(10)}>Settings</Btn>
      </div>

      <div className="tgg-title-meta">
        <Badge>DEMO DATA</Badge>
        <Badge tone="warn">NO CURRENCY AWARDED</Badge>
        <Badge tone="sim">LOCAL SAVE</Badge>
      </div>

      <p className="tgg-footnote">
        Screen 01 of 12. Mission stage and release state share one saved state object in this browser.
        Nothing is sent to a server, and no button grants CR, REP, XP or royalties.
      </p>
    </div>
  );
}

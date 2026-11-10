'use client';

import { Badge, Btn, KeyValue, Panel, ScreenHead } from '@/components/play/ui';
import { COUPE } from '@/lib/play/content';
import type { PlayApi } from '@/lib/play/types';

export function GarageScreen({ api }: { api: PlayApi }) {
  const driving = api.state.missionStage === 'drive-to-studio';

  return (
    <div className="tgg-screen">
      <ScreenHead
        id="05"
        title="Garage & TGG Motors"
        subtitle="Vehicle inspection · tuning · summon"
        onBack={() => api.go(2)}
      />

      <Panel title={COUPE.name} subtitle={'Starter ' + COUPE.className + ' · TGG Motors'} tag={<Badge tone="sim">DESIGN TARGETS</Badge>}>
        <div className="tgg-kv-list">
          <KeyValue label="Top speed" value={COUPE.topSpeedKph + ' km/h'} />
          <KeyValue label="Seats" value={COUPE.seats} />
          <KeyValue label="Price" value={COUPE.priceCr === 0 ? 'owned' : COUPE.priceCr.toLocaleString('en-US') + ' CR'} />
          <KeyValue label="Handling" value={COUPE.handling} />
        </div>
        <p className="tgg-footnote">{COUPE.note}</p>
        <div className="tgg-row">
          <Btn
            variant="primary"
            onClick={() => api.go(driving ? 12 : 2)}
            disabled={api.state.missionStage === 'hq'}
          >
            {driving ? 'Summon and drive' : 'Summon'}
          </Btn>
          <Btn variant="ghost" onClick={() => api.go(4)}>Missions</Btn>
        </div>
        {api.state.missionStage === 'hq' ? (
          <p className="tgg-note">Enter the coupe from the gameplay HUD to start the run.</p>
        ) : null}
      </Panel>

      <Panel title="Tuning" subtitle="Not editable in this slice" tag={<Badge tone="warn">LOCKED</Badge>}>
        <ul className="tgg-plain-list">
          <li><strong>Engine</strong><span className="tgg-dim">Stock. Build tiers arrive in Act II (`ii-04-tune-up`).</span></li>
          <li><strong>Tyres</strong><span className="tgg-dim">Street compound. No grip simulation in this build.</span></li>
          <li><strong>Paint</strong><span className="tgg-dim">Crimson over carbon. Cosmetic only.</span></li>
        </ul>
      </Panel>
    </div>
  );
}

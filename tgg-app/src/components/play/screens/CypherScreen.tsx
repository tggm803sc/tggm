'use client';

import { Badge, Btn, KeyValue, Panel, ScreenHead } from '@/components/play/ui';
import type { PlayApi } from '@/lib/play/types';

export function CypherScreen({ api }: { api: PlayApi }) {
  return (
    <div className="tgg-screen">
      <ScreenHead
        id="08"
        title="Cypher Street Plaza"
        subtitle="1v1 bracket · turn timer · flow meters · stakes"
        onBack={() => api.go(2)}
      />

      <Panel title="Act II bracket" subtitle="Frequency Wars · ii-01-open-mic" tag={<Badge tone="warn">LOCKED</Badge>}>
        <p className="tgg-dim">
          The cypher ladder is written for Act II. This slice ends after the Act I release, so the bracket
          stays closed rather than simulating a rated match.
        </p>
        <div className="tgg-kv-list">
          <KeyValue label="Rounds" value="3" />
          <KeyValue label="Bars per round" value="8" />
          <KeyValue label="Meters" value="delivery · pocket · crowd" />
          <KeyValue label="Stakes" value="REP only" />
        </div>
        <div className="tgg-row">
          <Btn variant="primary" onClick={() => api.go(2)}>Back to the city</Btn>
          <Btn variant="ghost" onClick={() => api.go(4)}>Mission center</Btn>
        </div>
      </Panel>

      <Panel title="No local scoring" subtitle="Honest-state note" tag={<Badge tone="sim">SIM</Badge>}>
        <p className="tgg-footnote">
          A tap-timing bar here would look like a cypher without being one. The rating, disconnect handling and
          crowd meter all need the authoritative match service, so none of them are faked.
        </p>
      </Panel>
    </div>
  );
}

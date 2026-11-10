'use client';

import { Badge, Btn, KeyValue, Panel, ScreenHead } from '@/components/play/ui';
import { initialState } from '@/lib/play/state';
import type { PlayApi } from '@/lib/play/types';

export function PauseScreen({ api }: { api: PlayApi }) {
  const fresh = initialState();

  return (
    <div className="tgg-screen">
      <ScreenHead
        id="10"
        title="Pause & Settings"
        subtitle="Resume · save state · restart · recovery"
        onBack={() => api.go(2)}
      />

      <Panel title="This run" subtitle="Saved in this browser only" tag={<Badge tone="ok">LOCAL SAVE</Badge>}>
        <div className="tgg-kv-list">
          <KeyValue label="Screen" value={String(api.state.screenId).padStart(2, '0')} />
          <KeyValue label="Mission stage" value={<span className="tgg-mono">{api.state.missionStage}</span>} />
          <KeyValue label="Release state" value={<span className="tgg-mono">{api.state.releaseState}</span>} />
          <KeyValue label="Deliveries" value={api.state.deliveries} />
        </div>
        <div className="tgg-row">
          <Btn variant="primary" onClick={() => api.go(2)}>Resume</Btn>
          <Btn onClick={() => api.go(1)}>Title screen</Btn>
          <Btn variant="ghost" onClick={() => api.go(11)}>Loading & recovery</Btn>
        </div>
      </Panel>

      <Panel title="Settings" subtitle="Audio and graphics are not wired in this slice" tag={<Badge tone="sim">INFO</Badge>}>
        <ul className="tgg-plain-list">
          <li><strong>Audio</strong><span className="tgg-dim">Sequencer only. Radio has no stream.</span></li>
          <li><strong>Graphics</strong><span className="tgg-dim">DOM interface, no 3D viewport yet.</span></li>
          <li><strong>Controls</strong><span className="tgg-dim">Touch, mouse and keyboard all drive the same state.</span></li>
        </ul>
      </Panel>

      <Panel title="Restart" subtitle="Clears the local save for this browser" tag={<Badge tone="warn">DESTRUCTIVE</Badge>}>
        <p className="tgg-dim">
          Restarts from <span className="tgg-mono">{fresh.missionStage}</span> with a draft session. Nothing external is deleted.
        </p>
        <Btn variant="danger" onClick={api.reset}>Restart the run</Btn>
      </Panel>
    </div>
  );
}

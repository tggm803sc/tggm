'use client';

import { useState } from 'react';
import { Badge, Btn, Panel, ScreenHead } from '@/components/play/ui';
import type { PlayApi } from '@/lib/play/types';

type Mode = 'idle' | 'conflict' | 'timeout';

export function LoadingScreen({ api }: { api: PlayApi }) {
  const [mode, setMode] = useState<Mode>('idle');

  return (
    <div className="tgg-screen">
      <ScreenHead
        id="11"
        title="Loading & Connection States"
        subtitle="Loading · sync conflict · timeout and retry"
        onBack={() => api.go(2)}
      />

      <Panel
        title={mode === 'idle' ? 'Ready' : mode === 'conflict' ? 'Sync conflict' : 'Connection timeout'}
        subtitle="Simulated states for layout and copy testing"
        tag={<Badge tone={mode === 'idle' ? 'ok' : 'warn'}>{mode.toUpperCase()}</Badge>}
      >
        {mode === 'idle' ? (
          <p className="tgg-dim">
            Nothing is loading. Use the controls below to preview the recovery screens the game needs
            when a save or session call fails.
          </p>
        ) : null}

        {mode === 'conflict' ? (
          <p className="tgg-dim">
            A local save and a server save disagree. Resolving keeps both copies until you choose; nothing is
            overwritten automatically.
          </p>
        ) : null}

        {mode === 'timeout' ? (
          <p className="tgg-dim">
            The request did not answer in time. Progress is still in memory; retrying reuses the same request
            id rather than starting a second write.
          </p>
        ) : null}

        <div className="tgg-row">
          <Btn onClick={() => setMode('conflict')}>Preview sync conflict</Btn>
          <Btn onClick={() => setMode('timeout')}>Preview timeout</Btn>
          <Btn variant="primary" onClick={() => setMode('idle')}>Retry</Btn>
          <Btn variant="ghost" onClick={() => api.go(2)}>Safe return</Btn>
        </div>
      </Panel>

      <p className="tgg-footnote">
        These are UI states only. No save service, network call or conflict resolution runs in this slice.
      </p>
    </div>
  );
}

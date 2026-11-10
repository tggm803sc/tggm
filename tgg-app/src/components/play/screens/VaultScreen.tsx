'use client';

import { Badge, Btn, KeyValue, Panel, ScreenHead } from '@/components/play/ui';
import { RELEASE, SAMPLE_REWARD } from '@/lib/play/content';
import type { PlayApi, ReleaseState } from '@/lib/play/types';

const STATES: ReleaseState[] = ['draft', 'mastered', 'delivery-pending', 'released'];

export function VaultScreen({ api }: { api: PlayApi }) {
  const release = api.state.releaseState;
  const currentIndex = STATES.indexOf(release);

  return (
    <div className="tgg-screen">
      <ScreenHead
        id="07"
        title="The Vault / Music Career"
        subtitle="Release state · delivery receipt · royalty summary"
        onBack={() => api.go(2)}
      />

      <Panel
        title={RELEASE.title}
        subtitle={RELEASE.artist + ' · ' + RELEASE.tracks + ' tracks'}
        tag={<Badge tone={release === 'released' ? 'ok' : 'demo'}>{release}</Badge>}
      >
        <ol className="tgg-vault-states">
          {STATES.map((state, index) => (
            <li
              key={state}
              className={'tgg-state-chip' + (index <= currentIndex ? ' tgg-state-on' : '')}
              aria-current={state === release ? 'step' : undefined}
            >
              {state}
            </li>
          ))}
        </ol>

        {release === 'draft' ? (
          <div className="tgg-row">
            <Btn variant="primary" onClick={() => api.go(6)}>Master at Studio 808</Btn>
            <span className="tgg-dim">Delivery is locked until a master exists.</span>
          </div>
        ) : null}

        {release === 'mastered' ? (
          <div className="tgg-row">
            <Btn variant="primary" onClick={api.sendToVault}>Send to the Vault desk</Btn>
            <span className="tgg-dim">The desk receives the master; it does not confirm by itself.</span>
          </div>
        ) : null}

        {release === 'delivery-pending' ? (
          <div className="tgg-row">
            <Btn variant="primary" onClick={api.confirmDelivery}>Confirm desk receipt</Btn>
            <span className="tgg-dim">
              DEMO: a real build would wait for the authoritative delivery event before showing released.
            </span>
          </div>
        ) : null}

        {release === 'released' ? (
          <div className="tgg-receipt">
            <p className="tgg-kicker">VAULT RECEIPT · DEMO</p>
            <KeyValue label="Status" value="released" />
            <KeyValue label="Release" value={RELEASE.title} />
            <KeyValue label="Format" value={RELEASE.metadata.format} />
            <KeyValue label="Splits" value={RELEASE.metadata.splits} />
            <KeyValue label="ISRC" value={<span className="tgg-mono">{RELEASE.metadata.isrc}</span>} />
            <p className="tgg-footnote">
              Receipt is local UI state. No file was uploaded and no distribution was triggered.
            </p>
          </div>
        ) : null}
      </Panel>

      <Panel title="Royalty summary" subtitle="Nonfinancial demo values" tag={<Badge tone="warn">DISPLAY ONLY</Badge>}>
        <div className="tgg-kv-list">
          <KeyValue label="Streams" value={<span className="tgg-mono">0 (DEMO)</span>} />
          <KeyValue label="Royalty balance" value={<span className="tgg-mono">$0.00 (DEMO)</span>} />
          <KeyValue label="Withdrawable" value="No" />
        </div>
        <p className="tgg-footnote">{RELEASE.royaltyNote}</p>
      </Panel>

      <Panel title="Sample Act I reward" subtitle="From the UI audit, never granted" tag={<Badge tone="warn">SAMPLE</Badge>}>
        <div className="tgg-kv-list">
          <KeyValue label="XP" value={'+' + SAMPLE_REWARD.xp} />
          <KeyValue label="REP" value={'+' + SAMPLE_REWARD.rep} />
          <KeyValue label="CR" value={'+$' + SAMPLE_REWARD.cr.toLocaleString('en-US')} />
        </div>
        <p className="tgg-footnote">{SAMPLE_REWARD.provenance}</p>
      </Panel>
    </div>
  );
}

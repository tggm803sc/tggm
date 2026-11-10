'use client';

import { useState } from 'react';
import { Badge, Btn, Panel, ScreenHead } from '@/components/play/ui';
import { activeTracks, BPM, canMaster, masterBlockReason, stepCount, TRACK_LABELS } from '@/lib/play/state';
import { useSequencer } from '@/lib/play/sequencer';
import { STEPS, TRACKS, type PlayApi } from '@/lib/play/types';

export function StudioScreen({ api }: { api: PlayApi }) {
  const [playing, setPlaying] = useState(false);
  const playhead = useSequencer(api.state.pattern, playing);
  const block = masterBlockReason(api.state);
  const mastered = api.state.releaseState !== 'draft';

  return (
    <div className="tgg-screen">
      <ScreenHead
        id="06"
        title="Studio 808"
        subtitle="16 steps · five tracks · master and deliver"
        onBack={() => api.go(2)}
      />

      <Panel
        title="Session 01"
        subtitle={'Harbour Row — Session 01 · ' + BPM + ' BPM'}
        tag={<Badge tone={mastered ? 'ok' : 'demo'}>{mastered ? 'MASTERED' : 'DRAFT'}</Badge>}
      >
        <div className="tgg-transport">
          <Btn variant={playing ? 'danger' : 'primary'} onClick={() => setPlaying((value) => !value)}>
            {playing ? 'Stop' : 'Play'}
          </Btn>
          <span className="tgg-dim tgg-mono">
            {activeTracks(api.state.pattern)} tracks · {stepCount(api.state.pattern)} steps
          </span>
          <Btn variant="ghost" onClick={api.clearPattern} disabled={mastered}>Clear</Btn>
        </div>

        <div className="tgg-seq" role="group" aria-label="16 step sequencer">
          {TRACKS.map((track) => (
            <div key={track} className="tgg-seq-row">
              <span className="tgg-seq-label">{TRACK_LABELS[track]}</span>
              <div className="tgg-seq-cells">
                {Array.from({ length: STEPS }, (_, step) => (
                  <button
                    key={track + step}
                    type="button"
                    className={
                      'tgg-step' +
                      (api.state.pattern[track][step] ? ' tgg-step-on' : '') +
                      (playhead === step ? ' tgg-step-now' : '')
                    }
                    aria-pressed={api.state.pattern[track][step]}
                    aria-label={TRACK_LABELS[track] + ' step ' + (step + 1)}
                    onClick={() => api.toggleStep(track, step)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="tgg-row">
          <Btn variant="primary" onClick={api.master} disabled={block !== null}>
            {mastered ? 'Mastered' : 'Master the session'}
          </Btn>
          <Btn variant="ghost" onClick={() => api.go(7)}>The Vault</Btn>
        </div>
        {block ? <p className="tgg-note">{block}</p> : null}
        {!block && !mastered ? (
          <p className="tgg-footnote">
            Mastering sets the release state to <span className="tgg-mono">mastered</span> and unlocks delivery.
            It does not grant currency, streams or royalties.
          </p>
        ) : null}
        {mastered ? (
          <p className="tgg-note">
            Master is rendered locally. Take it to the Vault desk to record delivery.
          </p>
        ) : null}
      </Panel>

      <Panel title="Session rules" subtitle="From the design bible" tag={<Badge tone="sim">INFO</Badge>}>
        <ul className="tgg-plain-list">
          <li><strong>Five tracks</strong><span className="tgg-dim">Drums, bass, keys, lead, FX.</span></li>
          <li><strong>Master gate</strong><span className="tgg-dim">Three active tracks and at least 12 programmed steps.</span></li>
          <li><strong>Audio clock</strong><span className="tgg-dim">Web Audio schedules the loop; the playhead follows the audio context, not the other way round.</span></li>
        </ul>
      </Panel>
    </div>
  );
}

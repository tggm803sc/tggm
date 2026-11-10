'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge, Btn, Panel, ScreenHead } from '@/components/play/ui';
import { DRIVE_ROUTE } from '@/lib/play/content';
import { percent } from '@/lib/play/state';
import type { PlayApi } from '@/lib/play/types';

const TICK_MS = 120;
const GAS_RATE = 0.012;
const BOOST_RATE = 0.03;
const BRAKE_RATE = 0.014;

export function MobileHud({ api }: { api: PlayApi }) {
  const [throttle, setThrottle] = useState(false);
  const [brake, setBrake] = useState(false);
  const [boostActive, setBoostActive] = useState(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const boostRef = useRef(false);

  const driving = api.state.missionStage === 'drive-to-studio';
  const arrived = api.state.missionStage === 'produce-master' || api.state.missionStage === 'deliver-to-vault' || api.state.missionStage === 'complete';

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = apiRef.current;
      if (current.state.missionStage !== 'drive-to-studio') return;
      const gain = throttle ? (boostRef.current ? BOOST_RATE : GAS_RATE) : 0;
      const loss = brake ? BRAKE_RATE : 0;
      const delta = gain - loss;
      if (delta !== 0) current.drive(current.state.driveProgress + delta);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [throttle, brake]);

  const startBoost = () => {
    if (!driving || boostActive) return;
    boostRef.current = true;
    setBoostActive(true);
    window.setTimeout(() => {
      boostRef.current = false;
      setBoostActive(false);
    }, 1500);
  };

  const remainingKm = Math.max(0, DRIVE_ROUTE.distanceKm * (1 - api.state.driveProgress));

  return (
    <div className="tgg-screen">
      <ScreenHead
        id="12"
        title="Mobile Gameplay HUD"
        subtitle="Touch movement · route progress · phone drawer"
        onBack={() => api.go(2)}
      />

      <Panel
        title={DRIVE_ROUTE.from + ' → ' + DRIVE_ROUTE.to}
        subtitle={DRIVE_ROUTE.note}
        tag={<Badge tone="sim">SIM</Badge>}
      >
        <div className="tgg-drive">
          <div className="tgg-drive-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(api.state.driveProgress * 100)}>
            <span className="tgg-drive-fill" style={{ width: percent(api.state.driveProgress) }} />
          </div>
          <div className="tgg-drive-meta">
            <span className="tgg-mono">{percent(api.state.driveProgress)}</span>
            <span className="tgg-dim">{remainingKm.toFixed(1)} km to the Studio 808 bay</span>
          </div>
        </div>

        {driving ? (
          <>
            <div className="tgg-pad" aria-label="Touch driving controls">
              <button
                type="button"
                className={'tgg-pad-btn' + (throttle ? ' tgg-pad-btn-active' : '')}
                onPointerDown={(event) => { event.preventDefault(); setThrottle(true); }}
                onPointerUp={() => setThrottle(false)}
                onPointerLeave={() => setThrottle(false)}
                onPointerCancel={() => setThrottle(false)}
                onContextMenu={(event) => event.preventDefault()}
              >
                Gas
                <small>hold</small>
              </button>
              <button
                type="button"
                className={'tgg-pad-btn' + (brake ? ' tgg-pad-btn-active' : '')}
                onPointerDown={(event) => { event.preventDefault(); setBrake(true); }}
                onPointerUp={() => setBrake(false)}
                onPointerLeave={() => setBrake(false)}
                onPointerCancel={() => setBrake(false)}
                onContextMenu={(event) => event.preventDefault()}
              >
                Brake
                <small>hold</small>
              </button>
              <button
                type="button"
                className="tgg-pad-btn tgg-pad-btn-wide"
                onPointerDown={(event) => { event.preventDefault(); setThrottle(false); setBrake(false); }}
                onContextMenu={(event) => event.preventDefault()}
              >
                Handbrake
                <small>release both</small>
              </button>
              <button
                type="button"
                className={'tgg-pad-btn' + (boostActive ? ' tgg-pad-btn-active' : '')}
                onClick={startBoost}
                disabled={boostActive}
              >
                Nitro
                <small>{boostActive ? 'engaged' : '1.5 s'}</small>
              </button>
            </div>
            <p className="tgg-note">
              Hold Gas to cover the route. This is a route-progress simulation, not vehicle physics.
            </p>
          </>
        ) : null}

        {arrived ? (
          <div className="tgg-row">
            <Btn variant="primary" onClick={() => api.go(6)}>Park and open Studio 808</Btn>
            <span className="tgg-dim">Arrived. The 808 bay is open.</span>
          </div>
        ) : null}

        {api.state.missionStage === 'hq' ? (
          <div className="tgg-row">
            <Btn variant="primary" onClick={api.enterCoupe}>Enter the coupe</Btn>
            <span className="tgg-dim">The run starts at the TGG HQ loading bay.</span>
          </div>
        ) : null}
      </Panel>

      <div className="tgg-row">
        <Btn onClick={() => api.go(3)}>Open phone</Btn>
        <Btn variant="ghost" onClick={() => api.go(2)}>Full HUD</Btn>
        <Btn variant="ghost" onClick={() => api.go(4)}>Mission</Btn>
      </div>
    </div>
  );
}

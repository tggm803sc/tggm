'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  clearSavedState,
  initialState,
  loadState,
  reducer,
  saveState,
  screenLabel,
} from '@/lib/play/state';
import { SCREEN_DEFS, type PlayApi, type ScreenId } from '@/lib/play/types';
import { CypherScreen } from '@/components/play/screens/CypherScreen';
import { GameplayHud } from '@/components/play/screens/GameplayHud';
import { GarageScreen } from '@/components/play/screens/GarageScreen';
import { LoadingScreen } from '@/components/play/screens/LoadingScreen';
import { MissionCenter } from '@/components/play/screens/MissionCenter';
import { MobileHud } from '@/components/play/screens/MobileHud';
import { MultiplayerScreen } from '@/components/play/screens/MultiplayerScreen';
import { PauseScreen } from '@/components/play/screens/PauseScreen';
import { PhoneScreen } from '@/components/play/screens/PhoneScreen';
import { StudioScreen } from '@/components/play/screens/StudioScreen';
import { TitleScreen } from '@/components/play/screens/TitleScreen';
import { VaultScreen } from '@/components/play/screens/VaultScreen';

export function PlayClient() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadState();
    if (saved) dispatch({ type: 'hydrate', state: saved });

    const match = /^s(\d{1,2})$/.exec(window.location.hash.replace('#', ''));
    if (match) {
      const id = Number(match[1]);
      const def = SCREEN_DEFS.find((screen) => screen.id === id);
      if (def) dispatch({ type: 'navigate', screenId: def.id });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const hash = '#s' + String(state.screenId).padStart(2, '0');
    window.history.replaceState(null, '', hash);
  }, [state.screenId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        dispatch({ type: 'navigate', screenId: state.screenId === 10 ? 2 : 10 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hydrated, state.screenId]);

  const api = useMemo<PlayApi>(
    () => ({
      state,
      go: (screenId: ScreenId) => dispatch({ type: 'navigate', screenId }),
      togglePause: (paused: boolean) => dispatch({ type: 'pause', paused }),
      reset: () => {
        clearSavedState();
        dispatch({ type: 'reset' });
      },
      enterCoupe: () => dispatch({ type: 'enter-coupe' }),
      drive: (progress: number) => dispatch({ type: 'drive', progress }),
      toggleStep: (track, step) => dispatch({ type: 'toggle-step', track, step }),
      clearPattern: () => dispatch({ type: 'clear-pattern' }),
      master: () => dispatch({ type: 'master' }),
      sendToVault: () => dispatch({ type: 'send-to-vault' }),
      confirmDelivery: () => dispatch({ type: 'confirm-delivery' }),
    }),
    [state],
  );

  return (
    <div className="tgg-shell">
      <div className="tgg-statusbar">
        <span className="tgg-mono">{screenLabel(state.screenId)}</span>
        <span className="tgg-dim">
          {hydrated ? 'saved locally' : 'loading'} · {state.missionStage}
        </span>
      </div>

      {state.screenId === 1 ? <TitleScreen api={api} /> : null}
      {state.screenId === 2 ? <GameplayHud api={api} /> : null}
      {state.screenId === 3 ? <PhoneScreen api={api} /> : null}
      {state.screenId === 4 ? <MissionCenter api={api} /> : null}
      {state.screenId === 5 ? <GarageScreen api={api} /> : null}
      {state.screenId === 6 ? <StudioScreen api={api} /> : null}
      {state.screenId === 7 ? <VaultScreen api={api} /> : null}
      {state.screenId === 8 ? <CypherScreen api={api} /> : null}
      {state.screenId === 9 ? <MultiplayerScreen api={api} /> : null}
      {state.screenId === 10 ? <PauseScreen api={api} /> : null}
      {state.screenId === 11 ? <LoadingScreen api={api} /> : null}
      {state.screenId === 12 ? <MobileHud api={api} /> : null}

      <nav className="tgg-tabbar" aria-label="Screens">
        {SCREEN_DEFS.map((screen) => (
          <button
            key={screen.id}
            type="button"
            className={'tgg-tab' + (state.screenId === screen.id ? ' tgg-tab-active' : '')}
            title={screen.name}
            aria-label={String(screen.id).padStart(2, '0') + ' ' + screen.name}
            aria-current={state.screenId === screen.id ? 'page' : undefined}
            onClick={() => dispatch({ type: 'navigate', screenId: screen.id })}
          >
            {String(screen.id).padStart(2, '0')}
          </button>
        ))}
      </nav>
    </div>
  );
}

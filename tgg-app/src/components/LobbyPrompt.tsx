'use client';

type LobbyPromptProps = {
  lobbyId: string;
  players: number;
  capacity: number;
  onJoin?: () => void;
};

export function LobbyPrompt({ lobbyId, players, capacity, onJoin }: LobbyPromptProps) {
  const full = players >= capacity;

  return (
    <section aria-label={`Lobby ${lobbyId}`}>
      <h2>Lobby Ready</h2>
      <p>{players} / {capacity} players connected</p>
      <button type="button" disabled={full || !onJoin} onClick={onJoin}>
        {full ? 'Lobby Full' : 'Join Lobby'}
      </button>
    </section>
  );
}

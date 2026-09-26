'use client';

type ServerSnapshot = {
  host: string;
  status: 'online' | 'degraded' | 'offline';
  players: number;
  tickRate?: number;
  build?: string;
};

export function LiveServerConsole({ servers }: { servers: ServerSnapshot[] }) {
  return (
    <section aria-label="Live server console">
      <h2>Live Server Console</h2>
      <table>
        <thead>
          <tr><th>Host</th><th>Status</th><th>Players</th><th>Tick</th><th>Build</th></tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr key={server.host}>
              <td>{server.host}</td>
              <td>{server.status}</td>
              <td>{server.players}</td>
              <td>{server.tickRate ?? '—'}</td>
              <td>{server.build ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

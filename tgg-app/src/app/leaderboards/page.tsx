import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function LeaderboardsPage() {
  const players = await db.tggPlayer.findMany({
    orderBy: [{ experience: 'desc' }, { createdAt: 'asc' }],
    take: 100,
    select: { id: true, displayName: true, steamId: true, experience: true },
  });

  return (
    <main>
      <h1>Global Leaderboards</h1>
      <ol>
        {players.map((player) => (
          <li key={player.id}>
            <strong>{player.displayName ?? player.steamId ?? player.id}</strong>
            {' — '}
            {player.experience.toLocaleString()} XP
          </li>
        ))}
      </ol>
    </main>
  );
}

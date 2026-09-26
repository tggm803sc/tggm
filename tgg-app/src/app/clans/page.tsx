import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ClansPage() {
  const clans = await db.tggClan.findMany({
    orderBy: [{ rating: 'desc' }, { name: 'asc' }],
    take: 100,
    include: { _count: { select: { members: true } } },
  });

  return (
    <main>
      <h1>Clan Rankings</h1>
      <ol>
        {clans.map((clan) => (
          <li key={clan.id}>
            <strong>{clan.name}</strong>
            {' — '}
            {clan.rating} rating · {clan._count.members} members
          </li>
        ))}
      </ol>
    </main>
  );
}

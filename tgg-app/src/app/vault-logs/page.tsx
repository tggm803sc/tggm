import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function VaultLogsPage() {
  const logs = await db.tggVaultLedger.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <main>
      <h1>Vault Audit Trail</h1>
      <table>
        <thead>
          <tr><th>Transfer</th><th>From</th><th>To</th><th>Amount</th><th>Created</th></tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.transferId}</td>
              <td>{log.fromAccount}</td>
              <td>{log.toAccount}</td>
              <td>{log.amount.toString()}</td>
              <td>{log.createdAt.toISOString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

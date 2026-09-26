import { db } from '@/lib/db';

export async function transferVaultBalance(input: {
  transferId: string;
  fromAccount: string;
  toAccount: string;
  amount: bigint;
  playerId?: string;
  memo?: string;
}) {
  if (!input.transferId || input.fromAccount === input.toAccount || input.amount <= 0n) {
    throw new Error('invalid_transfer');
  }

  return db.$transaction(async (tx) => {
    const existing = await tx.tggVaultLedger.findUnique({
      where: { transferId: input.transferId },
    });
    if (existing) return existing;

    const source = await tx.tggVaultAccount.findUnique({
      where: { id: input.fromAccount },
    });
    if (!source || source.balance < input.amount) {
      throw new Error('insufficient_funds');
    }

    await tx.tggVaultAccount.update({
      where: { id: input.fromAccount },
      data: { balance: { decrement: input.amount } },
    });

    await tx.tggVaultAccount.upsert({
      where: { id: input.toAccount },
      update: { balance: { increment: input.amount } },
      create: { id: input.toAccount, balance: input.amount },
    });

    return tx.tggVaultLedger.create({
      data: {
        transferId: input.transferId,
        fromAccount: input.fromAccount,
        toAccount: input.toAccount,
        amount: input.amount,
        playerId: input.playerId,
        memo: input.memo,
      },
    });
  }, { isolationLevel: 'Serializable' });
}

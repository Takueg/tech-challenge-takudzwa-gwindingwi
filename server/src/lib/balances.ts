import { db } from "./db.js";

export type NetBalance = {
  userId: string;
  netCents: number;
};

export type Transfer = {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
};

export function computeNetBalances(groupId: string): NetBalance[] {
  const group = db.groups.get(groupId);
  if (!group) throw new Error(`Group ${groupId} not found`);

  const net = new Map<string, number>();
  for (const userId of group.memberIds) net.set(userId, 0);

  for (const expense of db.expenses.values()) {
    if (expense.groupId !== groupId) continue;
    net.set(expense.paidByUserId, (net.get(expense.paidByUserId) ?? 0) + expense.amountCents);
    for (const split of expense.splits) {
      net.set(split.userId, (net.get(split.userId) ?? 0) - split.amountCents);
    }
  }

  for (const settlement of db.settlements.values()) {
    if (settlement.groupId !== groupId) continue;
    net.set(settlement.fromUserId, (net.get(settlement.fromUserId) ?? 0) + settlement.amountCents);
    net.set(settlement.toUserId, (net.get(settlement.toUserId) ?? 0) - settlement.amountCents);
  }

  // A settled former member has nothing left to show. Anyone else stays listed.
  return Array.from(net.entries())
    .filter(([userId, netCents]) => netCents !== 0 || group.memberIds.includes(userId))
    .map(([userId, netCents]) => ({ userId, netCents }));
}

/**
 * Greedy settlement: largest debtor pays largest creditor, repeat. Always settles
 * everyone in under one transfer per person, but isn't guaranteed to find the fewest.
 */
export function simplifyDebts(balances: NetBalance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.netCents - a.netCents);
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ userId: b.userId, netCents: -b.netCents }))
    .sort((a, b) => b.netCents - a.netCents);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.netCents, creditor.netCents);
    if (amount > 0) {
      transfers.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountCents: amount });
    }
    debtor.netCents -= amount;
    creditor.netCents -= amount;
    if (debtor.netCents === 0) i += 1;
    if (creditor.netCents === 0) j += 1;
  }
  return transfers;
}

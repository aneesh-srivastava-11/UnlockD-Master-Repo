import prisma from '../lib/prismaClient';

export interface NormalizedRecord {
  id: string;
  type: 'TRANSFER' | 'EXPENSE';
  date: Date;
  description: string | null;
  amount: number;
  category: { id: string; name: string } | null;
  accountName: string;
  status: string;
  direction: 'IN' | 'OUT';
}

export interface RecordFilters {
  q?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  minAmount?: number;
  maxAmount?: number;
  accountId?: string;
  type?: 'TRANSFER' | 'EXPENSE';
}

/**
 * Retrieves transactions and expenses separately based on filters, maps them to a normalized shape,
 * merges, and sorts them by date descending in application memory.
 *
 * NOTE: Using in-memory merge and sort instead of a raw SQL UNION is a deliberate simplicity
 * tradeoff given expected data volumes here. It keeps the codebase framework-native and database-agnostic.
 */
export async function getUnifiedRecords(userId: string, filters: RecordFilters): Promise<NormalizedRecord[]> {
  const { q, startDate, endDate, categoryId, minAmount, maxAmount, accountId, type } = filters;

  const records: NormalizedRecord[] = [];

  // 1. Fetch Transactions if type filter allows it
  if (!type || type === 'TRANSFER') {
    const txWhere: any = {
      AND: [
        {
          OR: [
            { fromAccount: { userId } },
            { toAccount: { userId } }
          ]
        }
      ]
    };

    if (q) {
      txWhere.description = { contains: q, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      txWhere.createdAt = {};
      if (startDate) txWhere.createdAt.gte = new Date(startDate);
      if (endDate) txWhere.createdAt.lte = new Date(endDate);
    }

    if (categoryId) {
      txWhere.categoryId = categoryId;
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      txWhere.amount = {};
      if (minAmount !== undefined) txWhere.amount.gte = minAmount;
      if (maxAmount !== undefined) txWhere.amount.lte = maxAmount;
    }

    if (accountId) {
      txWhere.AND.push({
        OR: [
          { fromAccountId: accountId },
          { toAccountId: accountId }
        ]
      });
    }

    const transactions = await prisma.transaction.findMany({
      where: txWhere,
      include: {
        fromAccount: true,
        toAccount: true,
        category: true
      }
    });

    for (const tx of transactions) {
      let accountName = '';
      if (tx.fromAccount.userId === userId && tx.toAccount.userId === userId) {
        accountName = `${tx.fromAccount.name} → ${tx.toAccount.name}`;
      } else if (tx.fromAccount.userId === userId) {
        accountName = `${tx.fromAccount.name} → External`;
      } else {
        accountName = `External → ${tx.toAccount.name}`;
      }

      let direction: 'IN' | 'OUT' = 'OUT';
      if (tx.fromAccount.userId === userId && tx.toAccount.userId === userId) {
        if (accountId === tx.fromAccountId) {
          direction = 'OUT';
        } else if (accountId === tx.toAccountId) {
          direction = 'IN';
        } else {
          direction = 'OUT'; // Default to OUT for outgoing transfers
        }
      } else if (tx.fromAccount.userId === userId) {
        direction = 'OUT';
      } else if (tx.toAccount.userId === userId) {
        direction = 'IN';
      }

      records.push({
        id: tx.id,
        type: 'TRANSFER',
        date: tx.createdAt,
        description: tx.description,
        amount: parseFloat(tx.amount.toString()),
        category: tx.category ? { id: tx.category.id, name: tx.category.name } : null,
        accountName,
        status: tx.status,
        direction
      });
    }
  }

  // 2. Fetch Expenses if type filter allows it
  if (!type || type === 'EXPENSE') {
    const expWhere: any = {
      userId
    };

    if (q) {
      expWhere.description = { contains: q, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      expWhere.createdAt = {};
      if (startDate) expWhere.createdAt.gte = new Date(startDate);
      if (endDate) expWhere.createdAt.lte = new Date(endDate);
    }

    if (categoryId) {
      expWhere.categoryId = categoryId;
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      expWhere.amount = {};
      if (minAmount !== undefined) expWhere.amount.gte = minAmount;
      if (maxAmount !== undefined) expWhere.amount.lte = maxAmount;
    }

    if (accountId) {
      expWhere.accountId = accountId;
    }

    const expenses = await prisma.expense.findMany({
      where: expWhere,
      include: {
        account: true,
        category: true
      }
    });

    for (const exp of expenses) {
      records.push({
        id: exp.id,
        type: 'EXPENSE',
        date: exp.createdAt,
        description: exp.description,
        amount: parseFloat(exp.amount.toString()),
        category: exp.category ? { id: exp.category.id, name: exp.category.name } : null,
        accountName: exp.account.name,
        status: 'COMPLETED',
        direction: 'OUT'
      });
    }
  }

  // Sort by date descending
  records.sort((a, b) => b.date.getTime() - a.date.getTime());

  return records;
}

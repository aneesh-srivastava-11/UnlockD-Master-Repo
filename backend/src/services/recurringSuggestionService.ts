import { Prisma } from '@prisma/client';
import prisma from '../lib/prismaClient';
import { createExpense } from './expenseService';

/**
 * Normalized merchant comparison helper
 */
function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

/**
 * Analyze past confirmed expenses, detect recurring cadence,
 * and create RecurringSuggestion records if expected dates have arrived/passed.
 */
export async function checkRecurringSuggestions(userId: string) {
  // 1. Fetch all confirmed expenses for this user
  const expenses = await prisma.expense.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });

  // 2. Group expenses by normalized description (merchant)
  const groups = new Map<string, typeof expenses>();
  for (const exp of expenses) {
    const key = normalize(exp.description);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(exp);
  }

  // 3. For each group, look for matches in amount tolerance (5%)
  for (const [merchantKey, groupExpenses] of groups.entries()) {
    // If fewer than 2 expenses overall for this merchant, it cannot be recurring
    if (groupExpenses.length < 2) continue;

    // Cluster matching occurrences by amount.
    // For each expense, check if it can form a matching set of size >= 2.
    const clusters: Array<typeof expenses> = [];
    const visited = new Set<string>();

    for (const exp of groupExpenses) {
      if (visited.has(exp.id)) continue;
      const amt1 = parseFloat(exp.amount.toString());
      const lower = amt1 * 0.95;
      const upper = amt1 * 1.05;

      const cluster = groupExpenses.filter(e => {
        const amt2 = parseFloat(e.amount.toString());
        return amt2 >= lower && amt2 <= upper;
      });

      if (cluster.length >= 2) {
        clusters.push(cluster);
        for (const item of cluster) {
          visited.add(item.id);
        }
      }
    }

    // Process each clustered sequence of matching recurring expenses
    for (const cluster of clusters) {
      // Sort cluster ascending by createdAt
      cluster.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const lastExpense = cluster[cluster.length - 1];
      const lastExpenseDate = new Date(lastExpense.createdAt);

      // Compute expected date: +30 days after last logged occurrence
      const expectedDate = new Date(lastExpenseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();

      // If next expected date is today or in the past
      if (expectedDate.getTime() <= now.getTime()) {
        const amt = parseFloat(lastExpense.amount.toString());

        // Check if there is already an expense logged after the last occurrence date
        // which matches the merchant and similar amount. If yes, user already logged it.
        const alreadyLogged = await prisma.expense.findFirst({
          where: {
            userId,
            description: {
              contains: lastExpense.description || '',
              mode: 'insensitive'
            },
            createdAt: {
              gt: lastExpenseDate
            },
            amount: {
              gte: new Prisma.Decimal(amt * 0.95),
              lte: new Prisma.Decimal(amt * 1.05)
            }
          }
        });

        if (alreadyLogged) {
          continue; // Already logged, skip suggestion
        }

        // Check if suggestion already exists for this user, merchant and expected window
        const suggestionWindowStart = new Date(expectedDate.getTime() - 15 * 24 * 60 * 60 * 1000);
        const suggestionWindowEnd = new Date(expectedDate.getTime() + 15 * 24 * 60 * 60 * 1000);

        const existingSuggestion = await prisma.recurringSuggestion.findFirst({
          where: {
            userId,
            merchant: {
              equals: lastExpense.description || '',
              mode: 'insensitive'
            },
            suggestedDate: {
              gte: suggestionWindowStart,
              lte: suggestionWindowEnd
            }
          }
        });

        if (existingSuggestion) {
          continue; // Already suggested for this period, skip to avoid duplicates
        }

        // Create the suggested entry!
        await prisma.recurringSuggestion.create({
          data: {
            userId,
            accountId: lastExpense.accountId,
            merchant: lastExpense.description || 'Recurring Expense',
            suggestedAmount: lastExpense.amount,
            categoryId: lastExpense.categoryId,
            suggestedDate: expectedDate,
            status: 'PENDING_REVIEW'
          }
        });
      }
    }
  }

  // Return all pending suggestions
  return listPendingSuggestions(userId);
}

/**
 * List all pending suggestions for a user
 */
export async function listPendingSuggestions(userId: string) {
  return prisma.recurringSuggestion.findMany({
    where: {
      userId,
      status: 'PENDING_REVIEW'
    },
    include: {
      account: { select: { id: true, name: true, balance: true } },
      category: { select: { id: true, name: true } }
    },
    orderBy: { suggestedDate: 'desc' }
  });
}

/**
 * Confirm a suggested recurring expense: creates a real Expense, marks suggestion CONFIRMED.
 */
export async function confirmSuggestion(userId: string, id: string) {
  const suggestion = await prisma.recurringSuggestion.findUnique({
    where: { id }
  });

  if (!suggestion || suggestion.userId !== userId) {
    const err = new Error('Recurring suggestion not found');
    (err as any).status = 404;
    throw err;
  }

  if (suggestion.status !== 'PENDING_REVIEW') {
    const err = new Error('Only pending suggestions can be confirmed.');
    (err as any).status = 400;
    throw err;
  }

  // Confirm category check
  if (!suggestion.categoryId) {
    const err = new Error('Category is required to confirm the suggestion.');
    (err as any).status = 400;
    throw err;
  }

  let expense;
  try {
    expense = await createExpense({
      userId,
      accountId: suggestion.accountId,
      categoryId: suggestion.categoryId,
      amount: parseFloat(suggestion.suggestedAmount.toString()),
      description: suggestion.merchant
    });
  } catch (error: any) {
    if (error.message === 'Insufficient funds in the account') {
      const account = await prisma.account.findUnique({ where: { id: suggestion.accountId } });
      const balance = account ? parseFloat(account.balance.toString()).toFixed(2) : 'unknown';
      const needed = parseFloat(suggestion.suggestedAmount.toString()).toFixed(2);
      const err = new Error(`Insufficient funds in ${account?.name || 'the selected account'}: balance Rs ${balance}, needed Rs ${needed}`);
      (err as any).status = 400;
      throw err;
    }
    throw error;
  }

  return prisma.recurringSuggestion.update({
    where: { id },
    data: {
      status: 'CONFIRMED',
      linkedExpenseId: expense.id
    },
    include: {
      account: { select: { id: true, name: true, balance: true } },
      category: { select: { id: true, name: true } },
      linkedExpense: true
    }
  });
}

/**
 * Reject a suggested recurring expense.
 */
export async function rejectSuggestion(userId: string, id: string) {
  const suggestion = await prisma.recurringSuggestion.findUnique({
    where: { id }
  });

  if (!suggestion || suggestion.userId !== userId) {
    const err = new Error('Recurring suggestion not found');
    (err as any).status = 404;
    throw err;
  }

  if (suggestion.status !== 'PENDING_REVIEW') {
    const err = new Error('Only pending suggestions can be rejected.');
    (err as any).status = 400;
    throw err;
  }

  return prisma.recurringSuggestion.update({
    where: { id },
    data: { status: 'REJECTED' }
  });
}

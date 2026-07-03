import prisma from '../lib/prismaClient';

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function endOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function getSpendingAnalytics(userId: string, filters: { startDate?: string; endDate?: string }) {
  const startDate = filters.startDate ? new Date(filters.startDate) : startOfCurrentMonth();
  const endDate = filters.endDate ? new Date(filters.endDate) : endOfCurrentMonth();

  const categoryExpenses = await prisma.expense.findMany({
    where: {
      userId,
      createdAt: { gte: startDate, lte: endDate }
    },
    include: { category: true }
  });

  const categoryTotals = new Map<string, number>();
  for (const expense of categoryExpenses) {
    const categoryName = expense.category.name;
    categoryTotals.set(categoryName, (categoryTotals.get(categoryName) || 0) + parseFloat(expense.amount.toString()));
  }

  const trendStart = new Date();
  trendStart.setMonth(trendStart.getMonth() - 5, 1);
  trendStart.setHours(0, 0, 0, 0);

  const trendExpenses = await prisma.expense.findMany({
    where: {
      userId,
      createdAt: { gte: trendStart }
    }
  });

  const monthTotals = new Map<string, number>();
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - index, 1);
    monthTotals.set(monthKey(date), 0);
  }

  for (const expense of trendExpenses) {
    const key = monthKey(expense.createdAt);
    if (monthTotals.has(key)) {
      monthTotals.set(key, (monthTotals.get(key) || 0) + parseFloat(expense.amount.toString()));
    }
  }

  const recurringExpenses = await prisma.importedTransaction.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      isRecurring: true,
      linkedExpenseId: { not: null }
    },
    include: {
      linkedExpense: { include: { category: true } },
      suggestedCategory: true
    },
    orderBy: { date: 'desc' },
    take: 20
  });

  return {
    byCategory: [...categoryTotals.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
    byMonth: [...monthTotals.entries()].map(([month, total]) => ({ month, total })),
    recurringExpenses: recurringExpenses.map((item) => ({
      id: item.id,
      merchant: item.merchant || item.rawDescription,
      amount: parseFloat(item.amount.toString()),
      date: item.date,
      category: item.linkedExpense?.category?.name || item.suggestedCategory?.name || 'Uncategorized'
    }))
  };
}

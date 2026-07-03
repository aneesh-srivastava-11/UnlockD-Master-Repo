import { Prisma } from '@prisma/client';
import prisma from '../lib/prismaClient';

/**
 * Service to handle Budget operations.
 * Handles creating/updating budget limits and calculating current month utilization.
 */

export interface UpsertBudgetInput {
  userId: string;
  categoryId: string;
  monthlyLimit: number;
}

/**
 * Creates or updates (upserts) a category's budget limit for the user.
 */
export async function upsertBudget(input: UpsertBudgetInput) {
  const { userId, categoryId, monthlyLimit } = input;

  // 1. Verify category exists and belongs to the user
  const category = await prisma.category.findUnique({
    where: { id: categoryId }
  });

  if (!category) {
    const err = new Error("Category not found");
    (err as any).status = 404;
    throw err;
  }

  if (category.userId !== userId) {
    const err = new Error("Access denied. You do not own this category.");
    (err as any).status = 403;
    throw err;
  }

  const limitDecimal = new Prisma.Decimal(monthlyLimit);

  // 2. Perform the upsert using the unique constraint @@unique([userId, categoryId])
  return await prisma.budget.upsert({
    where: {
      userId_categoryId: {
        userId,
        categoryId
      }
    },
    update: {
      monthlyLimit: limitDecimal
    },
    create: {
      userId,
      categoryId,
      monthlyLimit: limitDecimal
    },
    include: {
      category: true
    }
  });
}

/**
 * Returns all budgets with their utilization for the current calendar month.
 */
export async function getBudgetsWithUtilization(userId: string) {
  // 1. Calculate current calendar month boundary in local time
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 2. Aggregate current month's expenses by category in a single query
  const expenseSums = await prisma.expense.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    },
    _sum: {
      amount: true
    }
  });

  // 3. Fetch all budgets for the user
  const budgets = await prisma.budget.findMany({
    where: { userId },
    include: {
      category: true
    },
    orderBy: {
      category: {
        name: 'asc'
      }
    }
  });

  // 4. Map budgets to include utilization fields
  return budgets.map((budget) => {
    const spentSumObj = expenseSums.find(s => s.categoryId === budget.categoryId);
    const spent = spentSumObj?._sum.amount ? new Prisma.Decimal(spentSumObj._sum.amount) : new Prisma.Decimal(0);
    const limit = new Prisma.Decimal(budget.monthlyLimit);
    const remaining = limit.minus(spent);
    
    let percentUsed = 0;
    if (!limit.isZero()) {
      percentUsed = spent.dividedBy(limit).times(100).toNumber();
    }

    return {
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      monthlyLimit: limit.toString(),
      spent: spent.toString(),
      remaining: remaining.toString(),
      percentUsed: parseFloat(percentUsed.toFixed(2))
    };
  });
}

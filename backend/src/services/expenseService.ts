import { Prisma } from '@prisma/client';
import prisma from '../lib/prismaClient';

/**
 * Service to handle Expense operations.
 * Uses atomic transactions and SELECT FOR UPDATE row-level locking on the Account table
 * to ensure account balance integrity and prevent race conditions.
 */

export interface CreateExpenseInput {
  userId: string;
  accountId: string;
  categoryId: string;
  amount: number;
  description?: string;
}

export interface UpdateExpenseInput {
  amount?: number;
  categoryId?: string;
  description?: string;
}

/**
 * Creates an expense, verifies ownership and funds, and decrements the account balance atomically.
 */
export async function createExpense(input: CreateExpenseInput) {
  const { userId, accountId, categoryId, amount, description } = input;

  return await prisma.$transaction(async (tx) => {
    // 1. Lock the Account row using SELECT FOR UPDATE to prevent race conditions
    const accountRows = await tx.$queryRawUnsafe<any[]>(
      `SELECT id, "userId", balance FROM "Account" WHERE id = $1 FOR UPDATE`,
      accountId
    );
    const account = accountRows[0];

    if (!account) {
      throw new Error("Account not found");
    }

    // 2. Validate ownership of the account
    if (account.userId !== userId) {
      const err = new Error("Access denied. You do not own this account.");
      (err as any).status = 403;
      throw err;
    }

    // 3. Validate ownership of the category
    const category = await tx.category.findUnique({
      where: { id: categoryId }
    });
    if (!category || category.userId !== userId) {
      const err = new Error("Access denied. Invalid category.");
      (err as any).status = 403;
      throw err;
    }

    // 4. Overdraft prevention check
    const currentBalance = new Prisma.Decimal(account.balance);
    const expenseAmount = new Prisma.Decimal(amount);

    if (currentBalance.lessThan(expenseAmount)) {
      const err = new Error("Insufficient funds in the account");
      (err as any).status = 400;
      throw err;
    }

    // 5. Decrement the account balance
    await tx.account.update({
      where: { id: accountId },
      data: {
        balance: {
          decrement: expenseAmount
        }
      }
    });

    // 6. Create the Expense record
    return await tx.expense.create({
      data: {
        userId,
        accountId,
        categoryId,
        amount: expenseAmount,
        description
      },
      include: {
        category: true
      }
    });
  });
}

/**
 * Updates an expense. If the amount changes, adjusts the account balance by the delta atomically.
 */
export async function updateExpense(userId: string, expenseId: string, changes: UpdateExpenseInput) {
  return await prisma.$transaction(async (tx) => {
    // 1. Find existing expense and verify ownership
    const expense = await tx.expense.findUnique({
      where: { id: expenseId }
    });

    if (!expense) {
      const err = new Error("Expense not found");
      (err as any).status = 404;
      throw err;
    }

    if (expense.userId !== userId) {
      const err = new Error("Access denied. You do not own this expense.");
      (err as any).status = 403;
      throw err;
    }

    // 2. Validate new category if category is being changed
    if (changes.categoryId && changes.categoryId !== expense.categoryId) {
      const category = await tx.category.findUnique({
        where: { id: changes.categoryId }
      });
      if (!category || category.userId !== userId) {
        const err = new Error("Access denied. Invalid category.");
        (err as any).status = 403;
        throw err;
      }
    }

    // 3. Perform balance adjustment if amount changes
    if (changes.amount !== undefined) {
      const oldAmount = new Prisma.Decimal(expense.amount);
      const newAmount = new Prisma.Decimal(changes.amount);
      const delta = newAmount.minus(oldAmount);

      // Lock the account to prevent race conditions during update
      const accountRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, "userId", balance FROM "Account" WHERE id = $1 FOR UPDATE`,
        expense.accountId
      );
      const account = accountRows[0];

      if (!account) {
        throw new Error("Account not found");
      }

      if (delta.isPositive()) {
        // Expense increased, check if account has sufficient funds for the delta
        const currentBalance = new Prisma.Decimal(account.balance);
        if (currentBalance.lessThan(delta)) {
          const err = new Error("Insufficient funds in the account for this update");
          (err as any).status = 400;
          throw err;
        }

        // Decrement balance by delta
        await tx.account.update({
          where: { id: expense.accountId },
          data: {
            balance: {
              decrement: delta
            }
          }
        });
      } else if (delta.isNegative()) {
        // Expense decreased, credit the account by the absolute delta
        await tx.account.update({
          where: { id: expense.accountId },
          data: {
            balance: {
              increment: delta.abs()
            }
          }
        });
      }
    }

    // 4. Update the expense record
    return await tx.expense.update({
      where: { id: expenseId },
      data: {
        categoryId: changes.categoryId,
        amount: changes.amount !== undefined ? new Prisma.Decimal(changes.amount) : undefined,
        description: changes.description
      },
      include: {
        category: true
      }
    });
  });
}

/**
 * Deletes an expense and credits the account balance back by that amount atomically.
 */
export async function deleteExpense(userId: string, expenseId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Find existing expense and verify ownership
    const expense = await tx.expense.findUnique({
      where: { id: expenseId }
    });

    if (!expense) {
      const err = new Error("Expense not found");
      (err as any).status = 404;
      throw err;
    }

    if (expense.userId !== userId) {
      const err = new Error("Access denied. You do not own this expense.");
      (err as any).status = 403;
      throw err;
    }

    // 2. Lock the account
    const accountRows = await tx.$queryRawUnsafe<any[]>(
      `SELECT id, "userId", balance FROM "Account" WHERE id = $1 FOR UPDATE`,
      expense.accountId
    );
    const account = accountRows[0];
    if (!account) {
      throw new Error("Account not found");
    }

    // 3. Credit the account balance back by the expense amount
    await tx.account.update({
      where: { id: expense.accountId },
      data: {
        balance: {
          increment: new Prisma.Decimal(expense.amount)
        }
      }
    });

    // 4. Delete the expense
    return await tx.expense.delete({
      where: { id: expenseId }
    });
  });
}

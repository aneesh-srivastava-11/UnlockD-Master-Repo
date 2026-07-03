import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prismaClient';
import { createExpenseSchema, updateExpenseSchema, expenseQuerySchema } from '../validation/schemas';
import * as expenseService from '../services/expenseService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

// Gated by authMiddleware
router.use(authMiddleware);

/**
 * POST /expenses
 * Creates a new expense. Runs inside an atomic transaction with row-level locking on Account.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    // Validate request body
    const validationResult = createExpenseSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { accountId, categoryId, amount, description } = validationResult.data;

    const expense = await expenseService.createExpense({
      userId,
      accountId,
      categoryId,
      amount,
      description
    });

    return res.status(201).json(expense);
  } catch (error: any) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ error: error.message });
  }
});

/**
 * PATCH /expenses/:id
 * Updates an expense. If the amount changes, atomically shifts the account balance.
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id: expenseId } = req.params;

    // Validate request body
    const validationResult = updateExpenseSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const updated = await expenseService.updateExpense(userId, expenseId, validationResult.data);

    return res.status(200).json(updated);
  } catch (error: any) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ error: error.message });
  }
});

/**
 * DELETE /expenses/:id
 * Deletes an expense and credits back the account balance.
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id: expenseId } = req.params;

    await expenseService.deleteExpense(userId, expenseId);

    return res.status(200).json({ message: "Expense deleted successfully" });
  } catch (error: any) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ error: error.message });
  }
});

/**
 * GET /expenses
 * Lists the authenticated user's expenses, with an optional month filter (?month=YYYY-MM).
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { month } = req.query;

    const whereClause: any = { userId };

    if (month && typeof month === 'string') {
      const validationResult = expenseQuerySchema.safeParse({ month });
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid month format. Please use YYYY-MM." });
      }

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthIndex = parseInt(monthStr, 10) - 1; // 0-indexed

      const startOfMonth = new Date(year, monthIndex, 1);
      const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

      whereClause.createdAt = {
        gte: startOfMonth,
        lte: endOfMonth
      };
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: {
        category: true,
        account: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json(expenses);
  } catch (error) {
    return next(error);
  }
});

export default router;

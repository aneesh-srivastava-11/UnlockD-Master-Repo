import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prismaClient';
import { upsertBudgetSchema } from '../validation/schemas';
import * as budgetService from '../services/budgetService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

// Gated by authMiddleware
router.use(authMiddleware);

/**
 * POST /budgets
 * Creates or updates (upserts) a category's monthly limit.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    // Validate request body
    const validationResult = upsertBudgetSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { categoryId, monthlyLimit } = validationResult.data;

    const budget = await budgetService.upsertBudget({
      userId,
      categoryId,
      monthlyLimit
    });

    return res.status(200).json(budget);
  } catch (error: any) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ error: error.message });
  }
});

/**
 * GET /budgets
 * Retrieves all budgets with their current-month utilization stats (spent, remaining, percentUsed).
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const utilization = await budgetService.getBudgetsWithUtilization(userId);

    return res.status(200).json(utilization);
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /budgets/:categoryId
 * Clears (deletes) a category's budget limit for the authenticated user.
 */
router.delete('/:categoryId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { categoryId } = req.params;

    const budget = await prisma.budget.findUnique({
      where: {
        userId_categoryId: {
          userId,
          categoryId
        }
      }
    });

    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }

    await prisma.budget.delete({
      where: {
        userId_categoryId: {
          userId,
          categoryId
        }
      }
    });

    return res.status(200).json({ message: "Budget limit cleared successfully" });
  } catch (error) {
    return next(error);
  }
});

export default router;

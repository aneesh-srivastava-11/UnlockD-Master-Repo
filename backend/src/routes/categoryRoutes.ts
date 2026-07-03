import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prismaClient';
import { createCategorySchema } from '../validation/schemas';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

// Gated by authMiddleware
router.use(authMiddleware);

/**
 * POST /categories
 * Creates a new category for the authenticated user.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    // Validate request body
    const validationResult = createCategorySchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { name } = validationResult.data;

    const newCategory = await prisma.category.create({
      data: {
        name,
        userId
      }
    });

    return res.status(201).json(newCategory);
  } catch (error: any) {
    // Catch unique constraint violation (P2002) for unique user + name
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Category name already exists" });
    }
    return next(error);
  }
});

/**
 * GET /categories
 * Returns all categories belonging to the authenticated user.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' }
    });

    return res.status(200).json(categories);
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /categories/:id
 * Deletes a category. Blocked if the category is currently used by an Expense or Budget.
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id: categoryId } = req.params;

    // 1. Fetch category and check ownership
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    if (category.userId !== userId) {
      return res.status(403).json({ error: "Access denied. You do not own this category." });
    }

    // 2. Check if referenced by any Expense or Budget
    const expenseCount = await prisma.expense.count({
      where: { categoryId }
    });

    const budgetCount = await prisma.budget.count({
      where: { categoryId }
    });

    if (expenseCount > 0 || budgetCount > 0) {
      return res.status(400).json({
        error: "Cannot delete category because it is currently associated with expenses or budgets."
      });
    }

    // 3. Delete category
    await prisma.category.delete({
      where: { id: categoryId }
    });

    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    return next(error);
  }
});

export default router;

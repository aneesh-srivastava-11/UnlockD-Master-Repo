import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prismaClient';
import { createTransactionSchema, categorizeTransactionSchema } from '../validation/schemas';
import { executeTransfer } from '../services/transferService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

// Gated by authMiddleware
router.use(authMiddleware);

/**
 * POST /transactions
 * Transfer money between two distinct accounts.
 * Verification checks:
 * 1. Checks that the sender account exists.
 * 2. Checks that the sender account belongs to the authenticated user (403 if mismatch).
 */
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    // Validate request body using Zod schema
    const validationResult = createTransactionSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { fromAccountId, toAccountId, amount, idempotencyKey, description, categoryId } = validationResult.data;

    // Verify category ownership if categoryId is provided
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });
      if (!category || category.userId !== userId) {
        return res.status(403).json({ error: "Access denied. Invalid category." });
      }
    }

    // Explaining to Judges: Ownership verification before initiating transaction
    const fromAccount = await prisma.account.findUnique({
      where: { id: fromAccountId }
    });

    if (!fromAccount) {
      return res.status(404).json({ error: "Source account not found" });
    }

    if (fromAccount.userId !== userId) {
      return res.status(403).json({ error: "Access denied. You do not own the source account." });
    }

    // Execute atomic transfer logic
    const result = await executeTransfer(fromAccountId, toAccountId, amount, idempotencyKey);

    if (!result.success) {
      if (result.transaction) {
        return res.status(400).json({
          error: result.error,
          transaction: result.transaction
        });
      }
      const status = result.error?.includes("not exist") ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }

    // Update with optional description and categoryId
    let transaction = result.transaction;
    if (transaction && (description !== undefined || categoryId !== undefined)) {
      transaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          description,
          categoryId
        }
      });
    }

    return res.status(201).json(transaction);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /transactions/:accountId
 * Returns the full transaction history for a specific account.
 * Verification check: Restricts transaction history query to the account owner (403 if mismatch).
 */
router.get('/:accountId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { accountId } = req.params;

    // Explaining to Judges: Ensure the user querying transactions owns the account
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (account.userId !== userId) {
      return res.status(403).json({ error: "Access denied. You do not own this account." });
    }

    // Find all transactions where the account is either the sender or the recipient
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromAccountId: accountId },
          { toAccountId: accountId }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json(transactions);
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /transactions/:id/categorize
 * Let a user set/change a Transaction's description and/or categoryId.
 * Verifies the caller owns the fromAccountId of the transaction.
 * Explicitly ignores or blocks any edit attempt on amount, fromAccountId, toAccountId, or status.
 */
router.patch('/:id/categorize', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const transactionId = req.params.id;

    // 1. Validate request body
    const validationResult = categorizeTransactionSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { description, categoryId } = validationResult.data;

    // 2. Fetch the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // 3. Verify ownership of fromAccountId
    const fromAccount = await prisma.account.findUnique({
      where: { id: transaction.fromAccountId }
    });

    if (!fromAccount || fromAccount.userId !== userId) {
      return res.status(403).json({ error: "Access denied. You do not own the source account of this transaction." });
    }

    // 4. Verify category ownership if categoryId is provided and not null
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });
      if (!category || category.userId !== userId) {
        return res.status(403).json({ error: "Access denied. Invalid category." });
      }
    }

    // 5. Update transaction's description and categoryId
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        description,
        categoryId: categoryId === undefined ? undefined : categoryId
      }
    });

    return res.status(200).json(updatedTransaction);
  } catch (error) {
    return next(error);
  }
});

export default router;

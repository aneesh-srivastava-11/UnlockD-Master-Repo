import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prismaClient';
import { createGroupExpenseSchema } from '../validation/schemas';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();
router.use(authMiddleware);

/**
 * POST /groups/:id/expenses
 * Create a new GroupExpense inside a group.
 */
router.post('/:id/expenses', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const groupId = req.params.id;

    // 1. Validate request body
    const validation = createGroupExpenseSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { description, amount, paidByUserId, splitType, splits } = validation.data;

    // 2. Retrieve the group & check if active
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.isSettled) {
      return res.status(400).json({ error: 'Cannot log expenses in a settled group' });
    }

    // 3. Confirm the requester is a member of the group
    const requesterIsMember = group.members.some(m => m.userId === userId);
    if (!requesterIsMember) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // 4. Confirm the paidByUserId is in the group
    const paidByIsMember = group.members.some(m => m.userId === paidByUserId);
    if (!paidByIsMember) {
      return res.status(400).json({ error: 'The paying user is not a member of this group.' });
    }

    // 5. Generate splits
    interface SplitInput {
      userId: string;
      shareAmount: number;
    }
    const finalSplits: SplitInput[] = [];

    if (splitType === 'equal') {
      const membersCount = group.members.length;
      if (membersCount === 0) {
        return res.status(400).json({ error: 'Group has no members to split across' });
      }

      // To handle cents without rounding loss:
      const totalCents = Math.round(amount * 100);
      const baseCents = Math.floor(totalCents / membersCount);
      const remainderCents = totalCents % membersCount;

      // Sort member IDs to make remainder distribution deterministic (e.g. sorted by userId)
      const sortedMembers = [...group.members].sort((a, b) => a.userId.localeCompare(b.userId));

      sortedMembers.forEach((member, index) => {
        const addedCent = index < remainderCents ? 1 : 0;
        const shareCents = baseCents + addedCent;
        finalSplits.push({
          userId: member.userId,
          shareAmount: parseFloat((shareCents / 100).toFixed(2))
        });
      });
    } else {
      // Split type: custom
      // Ensure all custom split users belong to this group
      for (const split of splits) {
        const isMember = group.members.some(m => m.userId === split.userId);
        if (!isMember) {
          return res.status(400).json({ error: `User with ID ${split.userId} is not a member of this group.` });
        }
        finalSplits.push({
          userId: split.userId,
          shareAmount: split.shareAmount!
        });
      }
    }

    // 6. Bulk create the GroupExpense and its splits in a transaction
    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.groupExpense.create({
        data: {
          groupId,
          paidByUserId,
          description,
          amount
        }
      });

      const splitData = finalSplits.map(s => ({
        groupExpenseId: newExpense.id,
        userId: s.userId,
        shareAmount: s.shareAmount
      }));

      await tx.expenseSplit.createMany({
        data: splitData
      });

      return tx.groupExpense.findUnique({
        where: { id: newExpense.id },
        include: {
          splits: true
        }
      });
    });

    return res.status(201).json(expense);
  } catch (error) {
    return next(error);
  }
});

export default router;

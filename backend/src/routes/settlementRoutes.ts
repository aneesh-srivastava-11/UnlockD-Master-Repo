import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prismaClient';
import { paySettlementSchema } from '../validation/schemas';
import { calculateSettlements } from '../services/settlementService';
import { executeTransfer } from '../services/transferService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();
router.use(authMiddleware);

/**
 * POST /groups/:id/settle
 * creator triggers netting algorithm to compute and bulk-create settlements.
 */
router.post('/groups/:id/settle', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const groupId = req.params.id;

    // 1. Retrieve group
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // 2. Only the group creator can trigger settle
    if (group.createdBy !== userId) {
      return res.status(403).json({ error: 'Access denied. Only the group creator can trigger Settle Up.' });
    }

    if (group.isSettled) {
      return res.status(400).json({ error: 'Group is already fully settled.' });
    }

    // 3. Idempotency safety check: prevent recalculation if settlements already exist
    const existingSettlements = await prisma.settlement.findMany({
      where: { groupId }
    });
    if (existingSettlements.length > 0) {
      return res.status(400).json({
        error: 'Settlements have already been calculated for this group and are pending resolution.'
      });
    }

    // 4. Calculate settlements using the netting algorithm
    const computedSettlements = await calculateSettlements(groupId);

    if (computedSettlements.length === 0) {
      // If balances are already 0, we can directly settle the group
      await prisma.group.update({
        where: { id: groupId },
        data: {
          isSettled: true,
          settledAt: new Date()
        }
      });
      return res.status(200).json({
        message: 'All member balances are already net zero. Group marked settled.',
        settlements: []
      });
    }

    // 5. Bulk create settlements
    const settlementRecords = await prisma.$transaction(async (tx) => {
      // Create each settlement
      const created = [];
      for (const s of computedSettlements) {
        const item = await tx.settlement.create({
          data: {
            groupId: s.groupId,
            fromUserId: s.fromUserId,
            toUserId: s.toUserId,
            amount: s.amount,
            status: 'PENDING'
          },
          include: {
            fromUser: { select: { id: true, email: true } },
            toUser: { select: { id: true, email: true } }
          }
        });
        created.push(item);
      }
      return created;
    });

    return res.status(201).json(settlementRecords);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /settlements/:id/pay
 * Debtor pays their outstanding settlement.
 */
router.post('/settlements/:id/pay', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const settlementId = req.params.id;

    // 1. Validate request body
    const validation = paySettlementSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { accountId } = validation.data;

    // 2. Fetch settlement
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId }
    });

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    if (settlement.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Settlement is already completed.' });
    }

    // 3. Verify caller is the fromUserId (debtor)
    if (settlement.fromUserId !== userId) {
      return res.status(403).json({ error: 'Access denied. You can only pay settlements where you are the debtor.' });
    }

    // 4. Verify caller owns the source account
    const fromAccount = await prisma.account.findUnique({
      where: { id: accountId }
    });
    if (!fromAccount) {
      return res.status(404).json({ error: 'Source account not found.' });
    }
    if (fromAccount.userId !== userId) {
      return res.status(403).json({ error: 'Access denied. You do not own the source account.' });
    }

    // 5. Look up recipient's primary account (oldest created)
    const recipientAccount = await prisma.account.findFirst({
      where: { userId: settlement.toUserId },
      orderBy: { createdAt: 'asc' }
    });
    if (!recipientAccount) {
      return res.status(404).json({ error: 'Recipient user does not have any active accounts to receive funds.' });
    }

    // 6. Execute atomic transfer using transferService.ts
    // Formulate a unique and deterministic idempotency key for this settlement
    const idempotencyKey = `pay-settlement-${settlement.id}`;

    const transferResult = await executeTransfer(
      accountId,
      recipientAccount.id,
      parseFloat(settlement.amount.toString()),
      idempotencyKey
    );

    // If transfer failed (e.g. insufficient funds)
    if (!transferResult.success) {
      return res.status(400).json({
        error: transferResult.error || 'Transfer failed',
        transaction: transferResult.transaction
      });
    }

    // Ensure "Settlement" category exists for the debtor
    let settlementCategory = await prisma.category.findFirst({
      where: {
        userId,
        name: {
          equals: 'Settlement',
          mode: 'insensitive'
        }
      }
    });

    if (!settlementCategory) {
      settlementCategory = await prisma.category.create({
        data: {
          userId,
          name: 'Settlement'
        }
      });
    }

    // Get group name
    const groupData = await prisma.group.findUnique({
      where: { id: settlement.groupId },
      select: { name: true }
    });
    const groupName = groupData?.name || 'Group';

    // Log the automatic expense record without decrementing the balance again
    await prisma.expense.create({
      data: {
        userId,
        accountId,
        categoryId: settlementCategory.id,
        amount: settlement.amount,
        description: `Settlement: ${groupName}`
      }
    });

    // 7. Update settlement record
    const updatedSettlement = await prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'COMPLETED',
        settledAt: new Date(),
        transactionId: transferResult.transaction.id
      },
      include: {
        fromUser: { select: { id: true, email: true } },
        toUser: { select: { id: true, email: true } }
      }
    });

    // 8. Check if group is fully settled (all settlements COMPLETED)
    const groupSettlements = await prisma.settlement.findMany({
      where: { groupId: settlement.groupId }
    });

    const allCompleted = groupSettlements.every(s => s.status === 'COMPLETED');

    if (allCompleted) {
      // Mark Group settled
      const group = await prisma.group.update({
        where: { id: settlement.groupId },
        data: {
          isSettled: true,
          settledAt: new Date()
        }
      });

      // Calculate creator's share: sum of creator's splits inside this group's expenses
      const creatorSplits = await prisma.expenseSplit.findMany({
        where: {
          userId: group.createdBy,
          groupExpense: {
            groupId: group.id
          }
        }
      });
      const creatorShare = creatorSplits.reduce((sum, split) => sum + parseFloat(split.shareAmount.toString()), 0);

      return res.status(200).json({
        message: 'Settlement paid. Group is now fully settled!',
        settlement: updatedSettlement,
        groupFullySettled: true,
        creatorUserId: group.createdBy,
        creatorShareAmount: creatorShare
      });
    }

    return res.status(200).json({
      message: 'Settlement paid successfully.',
      settlement: updatedSettlement,
      groupFullySettled: false
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

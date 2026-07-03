import { Prisma } from '@prisma/client';
import prisma from '../lib/prismaClient';

export interface TransferResult {
  success: boolean;
  transaction: any;
  error?: string;
}

/**
 * Executes a money transfer between two accounts atomically.
 * Ensures double-processing prevention using an idempotency key,
 * and overdraft/race-condition prevention using row locks (SELECT FOR UPDATE)
 * in ascending order by account ID to prevent deadlocks.
 */
export async function executeTransfer(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  idempotencyKey: string
): Promise<TransferResult> {
  // 1. Basic validation (in addition to router-level validation)
  if (amount <= 0) {
    return {
      success: false,
      transaction: null,
      error: "Transfer amount must be greater than zero"
    };
  }

  if (fromAccountId === toAccountId) {
    return {
      success: false,
      transaction: null,
      error: "Sender and recipient accounts must be different"
    };
  }

  // 2. Reject if idempotencyKey already used
  const existingTx = await prisma.transaction.findUnique({
    where: { idempotencyKey }
  });

  if (existingTx) {
    return {
      success: true, // Idempotency hit: return the original transaction as successful
      transaction: existingTx
    };
  }

  // Sort IDs to define a deterministic locking order and avoid deadlocks
  const [firstId, secondId] = [fromAccountId, toAccountId].sort();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 3. Lock both accounts in a consistent order (id ascending) using SELECT ... FOR UPDATE
      const firstAccountRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, name, balance FROM "Account" WHERE id = $1 FOR UPDATE`,
        firstId
      );
      const secondAccountRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, name, balance FROM "Account" WHERE id = $1 FOR UPDATE`,
        secondId
      );

      const firstAccount = firstAccountRows[0];
      const secondAccount = secondAccountRows[0];

      if (!firstAccount || !secondAccount) {
        throw new Error("One or both of the specified accounts do not exist");
      }

      // Map rows back to sender and recipient
      const fromAccount = firstId === fromAccountId ? firstAccount : secondAccount;
      const toAccount = firstId === fromAccountId ? secondAccount : firstAccount;

      const fromBalance = new Prisma.Decimal(fromAccount.balance);
      const transferAmount = new Prisma.Decimal(amount);

      // 4. Overdraft prevention check
      if (fromBalance.lessThan(transferAmount)) {
        // Create a FAILED transaction and commit it (no balance updates)
        const failedTx = await tx.transaction.create({
          data: {
            fromAccountId,
            toAccountId,
            amount: transferAmount,
            status: 'FAILED',
            idempotencyKey
          }
        });
        return {
          success: false,
          transaction: failedTx,
          error: "Insufficient funds in the sender account"
        };
      }

      // 5. Update balances
      // Decrement fromAccount
      await tx.account.update({
        where: { id: fromAccountId },
        data: {
          balance: {
            decrement: transferAmount
          }
        }
      });

      // Increment toAccount
      await tx.account.update({
        where: { id: toAccountId },
        data: {
          balance: {
            increment: transferAmount
          }
        }
      });

      // 6. Create COMPLETED transaction record
      const completedTx = await tx.transaction.create({
        data: {
          fromAccountId,
          toAccountId,
          amount: transferAmount,
          status: 'COMPLETED',
          idempotencyKey
        }
      });

      return {
        success: true,
        transaction: completedTx
      };
    });

    return result;

  } catch (error: any) {
    // If the database transaction fails (e.g. unique constraint violation, connection issue),
    // Prisma will roll back everything.
    return {
      success: false,
      transaction: null,
      error: error.message || "An unexpected error occurred during the transfer"
    };
  }
}

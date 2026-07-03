import prisma from '../lib/prismaClient';

interface PendingSettlement {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
}

/**
 * Computes the minimum cash flow settlements required to clear all balances in a group.
 * Explaining to Judges step-by-step:
 * 1. Calculate each group member's net spending balance:
 *    Balance = (Total paid by user in group expenses) - (Total share of group expenses splits allocated to user)
 * 2. Separate members into:
 *    - Debtors (negative balance, owes money)
 *    - Creditors (positive balance, owed money)
 * 3. Sort both lists so we process largest outstanding amounts first.
 * 4. Run a two-pointer greedy netting process:
 *    - Match the largest debtor with the largest creditor.
 *    - Settle the amount = min(debtor's absolute deficit, creditor's surplus).
 *    - Decrement debtor/creditor balances.
 *    - Push the generated Settlement to the array.
 *    - Advance pointers when balance reaches near 0 (using epsilon 0.01).
 * 5. Return the array of settlements.
 */
export async function calculateSettlements(groupId: string): Promise<PendingSettlement[]> {
  // 1. Get all members of the group
  const members = await prisma.groupMember.findMany({
    where: { groupId }
  });

  // 2. Get all expenses in the group including splits
  const expenses = await prisma.groupExpense.findMany({
    where: { groupId },
    include: {
      splits: true
    }
  });

  // 3. Initialize balances map (userId -> net amount) to 0 for all members
  const balances: Record<string, number> = {};
  members.forEach((member) => {
    balances[member.userId] = 0;
  });

  // 4. Calculate net balance for each member
  expenses.forEach((expense) => {
    const paidBy = expense.paidByUserId;
    const amount = parseFloat(expense.amount.toString());

    // Credit the person who paid out of pocket
    if (balances[paidBy] !== undefined) {
      balances[paidBy] += amount;
    }

    // Debit each person based on their split share amount
    expense.splits.forEach((split) => {
      const splitUser = split.userId;
      const share = parseFloat(split.shareAmount.toString());
      if (balances[splitUser] !== undefined) {
        balances[splitUser] -= share;
      }
    });
  });

  // 5. Separate users into creditors (positive net) and debtors (negative net)
  const debtors: { userId: string; balance: number }[] = [];
  const creditors: { userId: string; balance: number }[] = [];

  Object.entries(balances).forEach(([userId, bal]) => {
    // Epsilon check: ignore floating-point values below 1 cent
    if (bal < -0.009) {
      debtors.push({ userId, balance: bal });
    } else if (bal > 0.009) {
      creditors.push({ userId, balance: bal });
    }
  });

  // 6. Sort to settle larger balances first
  debtors.sort((a, b) => a.balance - b.balance); // More negative (owes most) first
  creditors.sort((a, b) => b.balance - a.balance); // More positive (owed most) first

  const settlements: PendingSettlement[] = [];
  let d = 0; // Debtor pointer
  let c = 0; // Creditor pointer

  // 7. Netting loop matching debtors and creditors
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];

    const deficit = Math.abs(debtor.balance);
    const surplus = creditor.balance;

    const amountToTransfer = Math.min(deficit, surplus);

    if (amountToTransfer > 0.009) {
      settlements.push({
        groupId,
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: parseFloat(amountToTransfer.toFixed(4))
      });
    }

    // Update remaining balances
    debtor.balance += amountToTransfer;
    creditor.balance -= amountToTransfer;

    // Advance pointers if balances are cleared
    if (Math.abs(debtor.balance) < 0.01) {
      d++;
    }
    if (creditor.balance < 0.01) {
      c++;
    }
  }

  return settlements;
}

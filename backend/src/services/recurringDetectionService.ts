import prisma from '../lib/prismaClient';

export interface RecurringSuggestion {
  isRecurring: boolean;
  suggestedCategoryId?: string;
}

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

/**
 * Simple recurring detector for imports:
 * if we have seen the same merchant/description with roughly the same amount at least twice,
 * flag it and suggest the most common historical category.
 */
export async function detectRecurringImport(userId: string, merchant: string, amount: number): Promise<RecurringSuggestion> {
  const normalizedMerchant = normalize(merchant);
  if (!normalizedMerchant) {
    return { isRecurring: false };
  }

  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      description: {
        contains: normalizedMerchant,
        mode: 'insensitive'
      }
    },
    select: {
      amount: true,
      categoryId: true
    }
  });

  const lowerBound = amount * 0.95;
  const upperBound = amount * 1.05;
  const matches = expenses.filter((expense) => {
    const historicalAmount = parseFloat(expense.amount.toString());
    return historicalAmount >= lowerBound && historicalAmount <= upperBound;
  });

  if (matches.length < 2) {
    return { isRecurring: false };
  }

  const categoryCounts = new Map<string, number>();
  for (const match of matches) {
    categoryCounts.set(match.categoryId, (categoryCounts.get(match.categoryId) || 0) + 1);
  }

  const suggestedCategoryId = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    isRecurring: true,
    suggestedCategoryId
  };
}

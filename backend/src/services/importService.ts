import { Prisma } from '@prisma/client';
import prisma from '../lib/prismaClient';
import { createExpense } from './expenseService';
import { detectRecurringImport } from './recurringDetectionService';
import { parseCsvStatement, ParseResult } from './parsers/csvParser';
import { parsePdfStatement } from './parsers/pdfParser';

export interface UploadImportInput {
  userId: string;
  accountId: string;
  file: Express.Multer.File;
}

export interface UpdateImportedTransactionInput {
  accountId?: string;
  merchant?: string | null;
  amount?: number;
  date?: string;
  categoryId?: string | null;
}

function detectSource(file: Express.Multer.File): 'CSV' | 'PDF' {
  const name = file.originalname.toLowerCase();
  const mimetype = file.mimetype.toLowerCase();

  if (name.endsWith('.csv') || mimetype.includes('csv')) return 'CSV';
  if (name.endsWith('.pdf') || mimetype.includes('pdf')) return 'PDF';

  throw new Error('Unsupported file type. Please upload a .csv or .pdf statement.');
}

async function verifyAccountOwnership(userId: string, accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    const err = new Error('Account not found');
    (err as any).status = 404;
    throw err;
  }
  if (account.userId !== userId) {
    const err = new Error('Access denied. You do not own this account.');
    (err as any).status = 403;
    throw err;
  }
}

async function verifyCategoryOwnership(userId: string, categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.userId !== userId) {
    const err = new Error('Access denied. Invalid category.');
    (err as any).status = 403;
    throw err;
  }
}

async function parseStatement(file: Express.Multer.File, source: 'CSV' | 'PDF'): Promise<ParseResult> {
  if (source === 'CSV') {
    return parseCsvStatement(file.buffer);
  }
  return parsePdfStatement(file.buffer);
}

export async function uploadImport(input: UploadImportInput) {
  const { userId, accountId, file } = input;
  await verifyAccountOwnership(userId, accountId);

  const source = detectSource(file);
  const parsed = await parseStatement(file, source);

  const created = [];
  for (const row of parsed.rows) {
    const recurring = await detectRecurringImport(userId, row.merchant, row.amount);
    const imported = await prisma.importedTransaction.create({
      data: {
        userId,
        accountId,
        source,
        rawDescription: row.rawDescription,
        merchant: row.merchant,
        amount: new Prisma.Decimal(row.amount),
        date: row.date,
        suggestedCategoryId: recurring.suggestedCategoryId,
        isRecurring: recurring.isRecurring
      },
      include: {
        account: { select: { id: true, name: true, balance: true } },
        suggestedCategory: true
      }
    });
    created.push(imported);
  }

  return {
    summary: parsed.summary,
    imports: created
  };
}

export async function listImports(userId: string, status: 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED') {
  return prisma.importedTransaction.findMany({
    where: { userId, status },
    include: {
      account: { select: { id: true, name: true, balance: true } },
      suggestedCategory: true,
      linkedExpense: true
    },
    orderBy: { date: 'desc' }
  });
}

export async function updateImport(userId: string, importId: string, changes: UpdateImportedTransactionInput) {
  const staged = await prisma.importedTransaction.findUnique({ where: { id: importId } });
  if (!staged || staged.userId !== userId) {
    const err = new Error('Imported transaction not found');
    (err as any).status = 404;
    throw err;
  }
  if (staged.status !== 'PENDING_REVIEW') {
    const err = new Error('Only pending imports can be edited.');
    (err as any).status = 400;
    throw err;
  }
  if (changes.categoryId) {
    await verifyCategoryOwnership(userId, changes.categoryId);
  }
  if (changes.accountId) {
    await verifyAccountOwnership(userId, changes.accountId);
  }

  return prisma.importedTransaction.update({
    where: { id: importId },
    data: {
      accountId: changes.accountId,
      merchant: changes.merchant,
      amount: changes.amount !== undefined ? new Prisma.Decimal(changes.amount) : undefined,
      date: changes.date ? new Date(changes.date) : undefined,
      suggestedCategoryId: changes.categoryId === undefined ? undefined : changes.categoryId
    },
    include: {
      account: { select: { id: true, name: true, balance: true } },
      suggestedCategory: true
    }
  });
}

export async function confirmImport(userId: string, importId: string) {
  const staged = await prisma.importedTransaction.findUnique({ where: { id: importId } });
  if (!staged || staged.userId !== userId) {
    const err = new Error('Imported transaction not found');
    (err as any).status = 404;
    throw err;
  }
  if (staged.status !== 'PENDING_REVIEW') {
    const err = new Error('Only pending imports can be confirmed.');
    (err as any).status = 400;
    throw err;
  }
  if (!staged.suggestedCategoryId) {
    const err = new Error('Category is required before confirming an imported transaction.');
    (err as any).status = 400;
    throw err;
  }

  let expense;
  try {
    expense = await createExpense({
      userId,
      accountId: staged.accountId,
      categoryId: staged.suggestedCategoryId,
      amount: parseFloat(staged.amount.toString()),
      description: staged.merchant || staged.rawDescription
    });
  } catch (error: any) {
    if (error.message === 'Insufficient funds in the account') {
      const account = await prisma.account.findUnique({ where: { id: staged.accountId } });
      const balance = account ? parseFloat(account.balance.toString()).toFixed(2) : 'unknown';
      const needed = parseFloat(staged.amount.toString()).toFixed(2);
      const err = new Error(`Insufficient funds in ${account?.name || 'the selected account'}: balance Rs ${balance}, needed Rs ${needed}`);
      (err as any).status = 400;
      throw err;
    }
    throw error;
  }

  return prisma.importedTransaction.update({
    where: { id: importId },
    data: {
      status: 'CONFIRMED',
      linkedExpenseId: expense.id
    },
    include: {
      account: { select: { id: true, name: true, balance: true } },
      suggestedCategory: true,
      linkedExpense: true
    }
  });
}

export async function rejectImport(userId: string, importId: string) {
  const staged = await prisma.importedTransaction.findUnique({ where: { id: importId } });
  if (!staged || staged.userId !== userId) {
    const err = new Error('Imported transaction not found');
    (err as any).status = 404;
    throw err;
  }
  if (staged.status !== 'PENDING_REVIEW') {
    const err = new Error('Only pending imports can be rejected.');
    (err as any).status = 400;
    throw err;
  }

  return prisma.importedTransaction.update({
    where: { id: importId },
    data: { status: 'REJECTED' }
  });
}

export async function bulkConfirmImports(userId: string, ids: string[]) {
  const results = [];

  for (const id of ids) {
    try {
      const imported = await confirmImport(userId, id);
      results.push({ id, success: true, imported });
    } catch (error: any) {
      results.push({ id, success: false, error: error.message || 'Failed to confirm import' });
    }
  }

  return results;
}

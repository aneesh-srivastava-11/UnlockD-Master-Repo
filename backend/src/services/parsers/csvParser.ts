import { parse } from 'csv-parse/sync';

export interface ParsedImportRow {
  date: Date;
  rawDescription: string;
  merchant: string;
  amount: number;
}

export interface ParseSummary {
  source: 'CSV' | 'PDF';
  linesProcessed: number;
  transactionsExtracted: number;
  skipped: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedImportRow[];
  summary: ParseSummary;
}

const headerVariants = {
  date: ['date', 'transaction date', 'posted date', 'value date'],
  description: ['description', 'merchant', 'narration', 'details', 'transaction details', 'particulars'],
  amount: ['amount', 'debit', 'withdrawal', 'withdrawals', 'transaction amount']
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findColumn(headers: string[], variants: string[]) {
  return headers.find((header) => variants.includes(normalizeHeader(header)));
}

function parseAmount(value: unknown) {
  const normalized = String(value ?? '').replace(/[₹,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.abs(amount) : NaN;
}

export function parseCsvStatement(buffer: Buffer): ParseResult {
  const records = parse(buffer.toString('utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  }) as Record<string, string>[];

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  const dateColumn = findColumn(headers, headerVariants.date);
  const descriptionColumn = findColumn(headers, headerVariants.description);
  const amountColumn = findColumn(headers, headerVariants.amount);

  if (!dateColumn || !descriptionColumn || !amountColumn) {
    const expected = [
      `date: ${headerVariants.date.join('/')}`,
      `description: ${headerVariants.description.join('/')}`,
      `amount: ${headerVariants.amount.join('/')}`
    ].join('; ');
    throw new Error(`Could not identify required CSV columns. Found headers: ${headers.join(', ') || 'none'}. Expected variants: ${expected}.`);
  }

  const rows: ParsedImportRow[] = [];
  let skipped = 0;

  for (const record of records) {
    const date = new Date(record[dateColumn]);
    const amount = parseAmount(record[amountColumn]);
    let rawDescription = String(record[descriptionColumn] ?? '').trim();

    if (!rawDescription) {
      const typeCol = findColumn(headers, ['type', 'transaction type']);
      const typeVal = typeCol ? String(record[typeCol]).trim().toUpperCase() : '';
      rawDescription = typeVal === 'TRANSFER' ? 'Transfer' : 'No description';
    }

    if (Number.isNaN(date.getTime()) || !Number.isFinite(amount) || amount <= 0) {
      skipped += 1;
      continue;
    }

    rows.push({
      date,
      amount,
      rawDescription,
      merchant: rawDescription
    });
  }

  return {
    rows,
    summary: {
      source: 'CSV',
      linesProcessed: records.length,
      transactionsExtracted: rows.length,
      skipped,
      message: `${records.length} rows processed, ${rows.length} transactions extracted, ${skipped} skipped`
    }
  };
}

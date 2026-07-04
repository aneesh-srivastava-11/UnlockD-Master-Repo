import { PDFParse } from 'pdf-parse';
import { ParsedImportRow, ParseResult } from './csvParser';

const datePattern = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})/;
const amountPattern = /(?:₹|Rs\.?)?\s*([+-]?\d[\d,]*(?:\.\d{1,2})?|\(\d[\d,]*(?:\.\d{1,2})?\))/g;

// Premium unified PDF format line parser regex
const lineRegex = /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})(?:,\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?\s+(TRANSFER|EXPENSE)\s+(.+?)\s+(\S+)\s+([+-]?(?:₹|Rs\.?)?\s*[\d,]+(?:\.\d{1,2})?)\s+(.+?)\s+(COMPLETED|PENDING|FAILED)/i;

function parseLooseDate(value: string) {
  const normalized = value.replace(/-/g, '/');
  const parts = normalized.split('/');

  if (parts[0].length === 4) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2].length === 2 ? `20${parts[2]}` : parts[2]);
  return new Date(year, month - 1, day);
}

function parseAmount(value: string) {
  const normalized = value.replace(/₹|Rs\.?/gi, '').replace(/[,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.abs(amount) : NaN;
}

/**
 * Best-effort PDF parser. Bank PDF layouts vary wildly, so this intentionally only accepts
 * lines with a clear date and amount and skips the rest instead of guessing.
 */
export async function parsePdfStatement(buffer: Buffer): Promise<ParseResult> {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();
  const lines = parsed.text.split(/\r?\n/).map((line: string) => line.trim()).filter(Boolean);
  const rows: ParsedImportRow[] = [];
  let skipped = 0;

  for (const line of lines) {
    // Skip header/footer/metadata rows to prevent incorrect transaction logs
    if (
      line.toLowerCase().includes('generated on:') ||
      line.toLowerCase().includes('applied filters:') ||
      line.toLowerCase().includes('report metadata') ||
      line.toLowerCase().includes('financista -') ||
      line.toLowerCase().includes('page ')
    ) {
      skipped += 1;
      continue;
    }

    // 1. Try to match the premium unified report format first
    const regexMatch = line.match(lineRegex);
    if (regexMatch) {
      const date = parseLooseDate(regexMatch[1]);
      const amount = parseAmount(regexMatch[5]);
      let rawDescription = regexMatch[3].trim();

      // Normalize fallbacks
      if (rawDescription.toLowerCase() === 'no description' || !rawDescription) {
        rawDescription = regexMatch[2].toUpperCase() === 'TRANSFER' ? 'Transfer' : 'No description';
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
      continue;
    }

    // 2. Fallback for custom/third-party PDF bank statements
    const dateMatch = line.match(datePattern);
    const amountMatches = [...line.matchAll(amountPattern)];
    const amountMatch = amountMatches[amountMatches.length - 1];

    if (!dateMatch || !amountMatch) {
      skipped += 1;
      continue;
    }

    const date = parseLooseDate(dateMatch[1]);
    const amount = parseAmount(amountMatch[1]);
    let rawDescription = line
      .replace(dateMatch[0], '')
      .replace(amountMatch[0], '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!rawDescription) {
      rawDescription = 'No description';
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
      source: 'PDF',
      linesProcessed: lines.length,
      transactionsExtracted: rows.length,
      skipped,
      message: `${lines.length} lines processed, ${rows.length} transactions extracted, ${skipped} skipped`
    }
  };
}

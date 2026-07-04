const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function cleanGarbledDescription(desc) {
  if (!desc) return null;
  
  if (desc.toLowerCase().includes('generated on:')) {
    return null;
  }

  // Check if it matches our garbled pattern
  const typeMatch = desc.match(/(TRANSFER|EXPENSE)/i);
  if (!typeMatch) return desc; // Not garbled, return as is!

  const type = typeMatch[1].toUpperCase();
  const index = desc.toUpperCase().indexOf(type);
  let remaining = desc.substring(index + type.length).trim();

  // Normalize spaces
  remaining = remaining.replace(/\s+/g, ' ');

  // 1. If it starts with "No description", clean it to null
  if (remaining.toLowerCase().startsWith('no description')) {
    return null;
  }

  // 2. If it starts with "Settlement Share:", it's a group settlement share
  if (remaining.toLowerCase().startsWith('settlement share:')) {
    const keyword = 'Settlement';
    const lastIdx = remaining.lastIndexOf(keyword);
    if (lastIdx > 0) {
      return remaining.substring(0, lastIdx).trim();
    }
  }

  // 3. If it starts with "Settlement:", it's a group settlement
  if (remaining.toLowerCase().startsWith('settlement:')) {
    const keyword = 'Settlement';
    const lastIdx = remaining.lastIndexOf(keyword);
    if (lastIdx > 0) {
      return remaining.substring(0, lastIdx).trim();
    }
  }

  // 4. Otherwise, it might be like "food food - send" or "car transport - send"
  // Let's look for the "-" or status or account separator
  const hyphenIdx = remaining.indexOf(' -');
  if (hyphenIdx > 0) {
    const descAndCat = remaining.substring(0, hyphenIdx).trim();
    const words = descAndCat.split(' ');
    if (words.length > 1) {
      const category = words.pop();
      const cleanedDesc = words.join(' ').trim();
      return cleanedDesc || null;
    }
    return descAndCat;
  }

  return remaining;
}

async function main() {
  const dryRun = process.argv.includes('--apply') ? false : true;
  console.log(`🧹 Database Description Cleanup Script (${dryRun ? 'APPLY MODE' : 'DRY RUN'})`);

  const expenses = await prisma.expense.findMany();
  const transactions = await prisma.transaction.findMany();

  let cleanExpenseCount = 0;
  let cleanTxCount = 0;

  console.log("\nAnalyzing Expenses...");
  for (const exp of expenses) {
    if (!exp.description) continue;
    const cleaned = cleanGarbledDescription(exp.description);
    if (cleaned !== exp.description) {
      console.log(`[EXPENSE] ID: ${exp.id}\n  Original: "${exp.description}"\n  Cleaned:  "${cleaned}"`);
      if (!dryRun) {
        await prisma.expense.update({
          where: { id: exp.id },
          data: { description: cleaned }
        });
      }
      cleanExpenseCount++;
    }
  }

  console.log("\nAnalyzing Transactions...");
  for (const tx of transactions) {
    if (!tx.description) continue;
    const cleaned = cleanGarbledDescription(tx.description);
    if (cleaned !== tx.description) {
      console.log(`[TRANSACTION] ID: ${tx.id}\n  Original: "${tx.description}"\n  Cleaned:  "${cleaned}"`);
      if (!dryRun) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { description: cleaned }
        });
      }
      cleanTxCount++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`- Expenses analyzed: ${expenses.length}, to clean: ${cleanExpenseCount}`);
  console.log(`- Transactions analyzed: ${transactions.length}, to clean: ${cleanTxCount}`);
  
  if (dryRun) {
    console.log("\n⚠️ This was a DRY RUN. No changes were made to the database. Run with '--apply' to clean the records.");
  } else {
    console.log("\n✅ Database updated successfully.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

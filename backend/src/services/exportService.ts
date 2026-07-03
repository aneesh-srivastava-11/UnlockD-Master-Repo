import PDFDocument from 'pdfkit';
import { NormalizedRecord } from './recordsService';

/**
 * Generates a CSV string from a list of normalized records.
 */
export function generateCSV(records: NormalizedRecord[]): string {
  const headers = ['Date', 'Type', 'Description', 'Category', 'Amount', 'Account', 'Status'];
  const rows = records.map(r => {
    const dateStr = r.date.toISOString();
    const typeStr = r.type;
    const descStr = r.description ? `"${r.description.replace(/"/g, '""')}"` : '""';
    const catStr = r.category ? `"${r.category.name.replace(/"/g, '""')}"` : '"Uncategorized"';
    // Format amount relative to direction
    const amtPrefix = r.direction === 'OUT' ? '-' : '';
    const amtStr = `${amtPrefix}${r.amount.toFixed(2)}`;
    const accStr = `"${r.accountName.replace(/"/g, '""')}"`;
    const statusStr = r.status;

    return [dateStr, typeStr, descStr, catStr, amtStr, accStr, statusStr].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates a PDF buffer from a list of normalized records.
 */
export function generatePDF(records: NormalizedRecord[], filtersSummary: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    // Title
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff').rect(0, 0, 595.28, 60).fill('#0f172a');
    doc.fillColor('#ffffff').text('Financista - Unified Money Movement Report', 30, 22, { align: 'left' });

    doc.fillColor('#000000').moveDown(3);

    // Metadata & Filters
    doc.fontSize(10).font('Helvetica-Bold').text('Report Metadata', 30, doc.y);
    doc.fontSize(9).font('Helvetica').text(`Generated On: ${new Date().toLocaleString()}`);
    doc.text(`Applied Filters: ${filtersSummary}`);
    doc.moveDown(1.5);

    // Table Header setup
    const startX = 30;
    const tableWidth = 535;
    const colWidths = [110, 55, 120, 80, 60, 60, 50]; // Total: 535
    const headers = ['Date', 'Type', 'Description', 'Category', 'Amount', 'Account', 'Status'];

    const drawHeader = (y: number) => {
      doc.rect(startX, y, tableWidth, 18).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      let curX = startX;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], curX + 4, y + 5, { width: colWidths[i] - 8, lineBreak: false });
        curX += colWidths[i];
      }
      doc.fillColor('#000000').font('Helvetica');
    };

    let curY = doc.y;
    drawHeader(curY);
    curY += 18;

    // Draw rows
    doc.fontSize(7);
    for (const r of records) {
      // Check for page overflow (A4 height is 841.89)
      if (curY > 780) {
        doc.addPage();
        curY = 30;
        drawHeader(curY);
        curY += 18;
        doc.fontSize(7);
      }

      // Draw light zebra stripes
      doc.rect(startX, curY, tableWidth, 16).fill(curY % 32 === 0 ? '#f8fafc' : '#ffffff');
      doc.fillColor('#0f172a');

      const dateStr = r.date.toLocaleString();
      const typeStr = r.type;
      const descStr = r.description || 'No description';
      const catStr = r.category ? r.category.name : 'Uncategorized';
      const amtPrefix = r.direction === 'OUT' ? '-' : '+';
      const amtStr = `${amtPrefix}Rs ${r.amount.toFixed(2)}`;
      const accStr = r.accountName;
      const statusStr = r.status;

      const rowValues = [dateStr, typeStr, descStr, catStr, amtStr, accStr, statusStr];
      let curX = startX;

      for (let i = 0; i < rowValues.length; i++) {
        // Color-code amounts
        if (i === 4) {
          doc.fillColor(r.direction === 'OUT' ? '#ef4444' : '#22c55e');
        } else {
          doc.fillColor('#0f172a');
        }
        doc.text(rowValues[i], curX + 4, curY + 4, { width: colWidths[i] - 8, height: 10, ellipsis: true });
        curX += colWidths[i];
      }

      // Draw bottom horizontal border line
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX, curY + 16).lineTo(startX + tableWidth, curY + 16).stroke();

      curY += 16;
    }

    doc.end();
  });
}

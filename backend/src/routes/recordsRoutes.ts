import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { recordsExportQuerySchema, recordsQuerySchema } from '../validation/schemas';
import { getUnifiedRecords } from '../services/recordsService';
import { generateCSV, generatePDF } from '../services/exportService';

const router = Router();
router.use(authMiddleware);

/**
 * GET /records
 * Returns unified paginated records search across both transactions and expenses.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    // 1. Validate query parameters
    const validationResult = recordsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map((err) => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const filters = validationResult.data;

    // 2. Fetch unified records
    const allRecords = await getUnifiedRecords(userId, filters);

    // 3. Paginate
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 25;
    const totalCount = allRecords.length;

    const startIndex = (page - 1) * pageSize;
    const paginatedRecords = allRecords.slice(startIndex, startIndex + pageSize);

    return res.status(200).json({
      records: paginatedRecords,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /records/export
 * Exports unified records report in CSV or PDF formats.
 */
router.get('/export', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    // 1. Validate query parameters
    const validationResult = recordsExportQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map((err) => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { format, ...filters } = validationResult.data as typeof validationResult.data & { format: 'csv' | 'pdf' };

    // 2. Fetch unified records (no pagination)
    const allRecords = await getUnifiedRecords(userId, filters);

    // 3. Summary details
    const summaryParts: string[] = [];
    if (filters.q) summaryParts.push(`Search: "${filters.q}"`);
    if (filters.startDate) summaryParts.push(`From: ${new Date(filters.startDate).toLocaleDateString()}`);
    if (filters.endDate) summaryParts.push(`To: ${new Date(filters.endDate).toLocaleDateString()}`);
    if (filters.categoryId) summaryParts.push('Filtered Category');
    if (filters.minAmount !== undefined) summaryParts.push(`Min: Rs ${filters.minAmount}`);
    if (filters.maxAmount !== undefined) summaryParts.push(`Max: Rs ${filters.maxAmount}`);
    if (filters.accountId) summaryParts.push('Filtered Account');
    if (filters.type) summaryParts.push(`Type: ${filters.type}`);

    const filtersSummary = summaryParts.length > 0 ? summaryParts.join(', ') : 'Full History';

    // 4. Return formatted report file
    if (format === 'pdf') {
      const pdfBuffer = await generatePDF(allRecords, filtersSummary);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=records_report.pdf');
      return res.status(200).send(pdfBuffer);
    } else {
      const csvString = generateCSV(allRecords);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=records.csv');
      return res.status(200).send(csvString);
    }
  } catch (error) {
    return next(error);
  }
});

export default router;

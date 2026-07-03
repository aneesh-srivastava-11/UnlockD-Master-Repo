import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { bulkConfirmImportSchema, importQuerySchema, updateImportSchema, uploadImportSchema } from '../validation/schemas';
import * as importService from '../services/importService';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(authMiddleware);

router.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const validation = uploadImportSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map((err) => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Statement file is required.' });
    }

    const result = await importService.uploadImport({
      userId,
      accountId: validation.data.accountId,
      file: req.file
    });

    return res.status(201).json(result);
  } catch (error: any) {
    if (error.message?.includes('Unsupported file type') || error.message?.includes('Could not identify')) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = importQuerySchema.safeParse(req.query);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map((err) => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const imports = await importService.listImports(req.userId!, validation.data.status);
    return res.status(200).json(imports);
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = updateImportSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map((err) => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const updated = await importService.updateImport(req.userId!, req.params.id, validation.data);
    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/confirm', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const confirmed = await importService.confirmImport(req.userId!, req.params.id);
    return res.status(200).json(confirmed);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/reject', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rejected = await importService.rejectImport(req.userId!, req.params.id);
    return res.status(200).json(rejected);
  } catch (error) {
    return next(error);
  }
});

router.post('/bulk-confirm', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = bulkConfirmImportSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map((err) => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const results = await importService.bulkConfirmImports(req.userId!, validation.data.ids);
    return res.status(200).json({ results });
  } catch (error) {
    return next(error);
  }
});

router.use((err: any, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File is too large. Please upload a statement under 5MB.' });
  }
  return next(err);
});

export default router;

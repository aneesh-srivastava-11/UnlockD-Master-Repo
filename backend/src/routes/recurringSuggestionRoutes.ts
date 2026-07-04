import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import * as recurringSuggestionService from '../services/recurringSuggestionService';

const router = Router();

// Gated by authentication middleware
router.use(authMiddleware);

/**
 * GET /recurring-suggestions/check
 * Runs analysis, inserts suggestions, and returns current pending ones
 */
router.get('/check', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const suggestions = await recurringSuggestionService.checkRecurringSuggestions(userId);
    return res.status(200).json(suggestions);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /recurring-suggestions
 * Lists all pending suggestions for the user
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const suggestions = await recurringSuggestionService.listPendingSuggestions(userId);
    return res.status(200).json(suggestions);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /recurring-suggestions/:id/confirm
 * Confirms suggestion, creating a real expense
 */
router.post('/:id/confirm', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const confirmed = await recurringSuggestionService.confirmSuggestion(userId, id);
    return res.status(200).json(confirmed);
  } catch (error: any) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ error: error.message });
  }
});

/**
 * POST /recurring-suggestions/:id/reject
 * Rejects a suggestion
 */
router.post('/:id/reject', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const rejected = await recurringSuggestionService.rejectSuggestion(userId, id);
    return res.status(200).json(rejected);
  } catch (error: any) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ error: error.message });
  }
});

export default router;

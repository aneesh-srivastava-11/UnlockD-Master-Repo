import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { analyticsQuerySchema } from '../validation/schemas';
import { getSpendingAnalytics } from '../services/analyticsService';

const router = Router();
router.use(authMiddleware);

router.get('/spending', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = analyticsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map((err) => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const analytics = await getSpendingAnalytics(req.userId!, validation.data);
    return res.status(200).json(analytics);
  } catch (error) {
    return next(error);
  }
});

export default router;

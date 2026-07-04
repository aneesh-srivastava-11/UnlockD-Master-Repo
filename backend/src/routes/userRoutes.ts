import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prismaClient';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

// Gated by authentication middleware
router.use(authMiddleware);

/**
 * GET /users/search?q=
 * Searches registered users by email and returns matching entries.
 * Returns id, email, and their active accounts.
 */
router.get('/search', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q;
    if (typeof q !== 'string' || q.trim().length < 2) {
      return res.status(200).json([]);
    }

    const searchStr = q.trim().toLowerCase();

    // Look up users by email
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: searchStr,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        email: true,
        accounts: {
          select: {
            id: true,
            name: true
          }
        }
      },
      take: 10
    });

    return res.status(200).json(users);
  } catch (error) {
    return next(error);
  }
});

export default router;

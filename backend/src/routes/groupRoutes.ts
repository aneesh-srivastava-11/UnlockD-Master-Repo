import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prismaClient';
import { createGroupSchema, addMemberSchema } from '../validation/schemas';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();
router.use(authMiddleware);

/**
 * POST /groups
 * Create a new group. Creator is automatically joined as a GroupMember.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const validation = createGroupSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { name } = validation.data;

    const group = await prisma.$transaction(async (tx) => {
      // 1. Create group
      const newGroup = await tx.group.create({
        data: {
          name,
          createdBy: userId
        }
      });

      // 2. Add creator as member
      await tx.groupMember.create({
        data: {
          groupId: newGroup.id,
          userId
        }
      });

      return newGroup;
    });

    return res.status(201).json(group);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /groups/:id/members
 * Add a registered user to the group by email address.
 */
router.post('/:id/members', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const groupId = req.params.id;

    const validation = addMemberSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { email } = validation.data;

    // 1. Check if group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // 2. Verify requester is in the group
    const requesterMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId }
      }
    });
    if (!requesterMembership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    if (group.isSettled) {
      return res.status(400).json({ error: 'Cannot add members to a settled group.' });
    }

    // 3. Find registered user by email
    const targetUser = await prisma.user.findUnique({
      where: { email }
    });
    if (!targetUser) {
      return res.status(404).json({ error: `No registered user found with email "${email}".` });
    }

    // 4. Check if already a member
    const existingMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: targetUser.id }
      }
    });
    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member of this group.' });
    }

    // 5. Add user to group
    const membership = await prisma.groupMember.create({
      data: {
        groupId,
        userId: targetUser.id
      },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    return res.status(201).json(membership);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /groups
 * List the current user's active groups (isSettled = false).
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, email: true }
                }
              }
            }
          }
        }
      }
    });

    const activeGroups = memberships
      .map(m => m.group)
      .filter(g => !g.isSettled)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return res.status(200).json(activeGroups);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /groups/settled
 * List the current user's settled groups (isSettled = true).
 */
router.get('/settled', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, email: true }
                }
              }
            }
          }
        }
      }
    });

    const settledGroups = memberships
      .map(m => m.group)
      .filter(g => g.isSettled)
      .sort((a, b) => (b.settledAt?.getTime() || 0) - (a.settledAt?.getTime() || 0));

    return res.status(200).json(settledGroups);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /groups/:id
 * Retrieve details for a specific group (members, expenses, settlements).
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const groupId = req.params.id;

    // 1. Confirm membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId }
      }
    });
    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // 2. Fetch full details
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true }
            }
          }
        },
        expenses: {
          include: {
            paidBy: {
              select: { id: true, email: true }
            },
            splits: {
              include: {
                user: {
                  select: { id: true, email: true }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        settlements: {
          include: {
            fromUser: {
              select: { id: true, email: true }
            },
            toUser: {
              select: { id: true, email: true }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    return res.status(200).json(group);
  } catch (error) {
    return next(error);
  }
});

export default router;

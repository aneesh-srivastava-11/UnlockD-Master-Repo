import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prismaClient';
import { signupSchema, loginSchema } from '../validation/schemas';

const router = Router();
const BCRYPT_SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'unlockd-hackathon-jwt-secret-2026';

/**
 * POST /signup
 * Validates request payload, hashes password, saves new user, and signs JWT.
 */
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Zod input validation
    const validationResult = signupSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { email, password } = validationResult.data;

    // 2. Duplicate checking
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: "A user with this email address already exists" });
    }

    // 3. Hash password using bcrypt with cost factor 10
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 4. Save to DB
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash
      }
    });

    // 5. Sign and return token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /login
 * Authenticates user, verifies password, and generates JWT.
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Zod input validation
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { email, password } = validationResult.data;

    // 2. Fetch user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // 3. Verify bcrypt hash matching
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

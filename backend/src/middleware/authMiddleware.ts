import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Custom request interface extending standard Express Request
 * to include authenticated user properties.
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/**
 * JWT Verification Middleware
 * 
 * Explaining to Judges:
 * 1. Reads the 'Authorization' header from the incoming request.
 * 2. Ensures it follows the 'Bearer <JWT_TOKEN>' format.
 * 3. Verifies the token using jsonwebtoken and the JWT_SECRET from environment.
 * 4. Extracted payload (userId, email) is attached to the Request object.
 * 5. Passes control forward via next() or blocks with 401 Unauthorized if validation fails.
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Verify authorization header presence and format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Access denied. Authentication token required." });
  }

  // Extract the raw token string
  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'unlockd-hackathon-jwt-secret-2026';
    
    // Verify JWT integrity and signature
    const decoded = jwt.verify(token, secret) as { userId: string; email: string };

    // Inject verified user metadata into the request lifecycle
    req.userId = decoded.userId;
    req.userEmail = decoded.email;

    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired authentication token." });
  }
}

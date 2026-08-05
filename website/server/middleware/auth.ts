import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as db from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.trim().length === 0) { console.error('FATAL: JWT_SECRET env var not set or empty'); process.exit(1); }

/* Valid roles (hierarchical): super_admin > admin > product_manager / order_manager > user */
export const ROLES = ['user', 'order_manager', 'product_manager', 'admin', 'super_admin'] as const;
export type UserRole = typeof ROLES[number];

/* Single DB lookup per request — sets fresh role (SEC-019) and validates token version (SEC-020) */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET!) as any;
    if (decoded.pending2FA) return res.status(401).json({ error: '2FA verification pending' });

    const user = await db.findUserById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    if ((decoded.tv ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }

    (req as any).userId = user.id;
    (req as any).userRole = user.role; // always fresh from DB
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/* Role checked against req.userRole which is already fresh from DB via authMiddleware */
export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).userRole;
  if (!role || !['admin', 'super_admin'].includes(role)) return res.status(403).json({ error: 'Admin access required' });
  next();
}

/* Sets userId/userRole if a valid token is present but does NOT fail if no token */
export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET!) as any;
    if (!decoded.pending2FA) {
      const user = await db.findUserById(decoded.id);
      if (user && (decoded.tv ?? 0) === user.tokenVersion) {
        (req as any).userId = user.id;
        (req as any).userRole = user.role;
      }
    }
  } catch {}
  next();
}

export function requireRole(...allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).userRole as UserRole;
    if (!role) return res.status(403).json({ error: 'Unauthorized' });
    if (role === 'super_admin' || allowed.includes(role)) return next();
    res.status(403).json({ error: `Requires role: ${allowed.join(' or ')}` });
  };
}

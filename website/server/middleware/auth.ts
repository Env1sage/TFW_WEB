import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as db from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET env var not set'); process.exit(1); }

/* Valid roles (hierarchical): super_admin > admin > product_manager / order_manager > user */
export const ROLES = ['user', 'order_manager', 'product_manager', 'admin', 'super_admin'] as const;
export type UserRole = typeof ROLES[number];

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET!) as any;
    if (decoded.pending2FA) return res.status(401).json({ error: '2FA verification pending' });
    (req as any).userId = decoded.id;
    (req as any).userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = await db.findUserById((req as any).userId);
  if (!user || !['admin', 'super_admin'].includes(user.role)) return res.status(403).json({ error: 'Admin access required' });
  next();
}

/** Middleware factory: allow only specific roles (super_admin always passes) */
export function requireRole(...allowed: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await db.findUserById((req as any).userId);
    if (!user) return res.status(403).json({ error: 'User not found' });
    if (user.role === 'super_admin' || allowed.includes(user.role as UserRole)) return next();
    res.status(403).json({ error: `Requires role: ${allowed.join(' or ')}` });
  };
}

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { v4 as uuid } from 'uuid';
import * as db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tfw-secret-key-change-in-prod';

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await db.findUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 12);
    const user = {
      id: uuid(),
      name,
      email,
      password: hashed,
      role: 'user',
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
    };
    await db.addUser(user);
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...safe } = user;
    res.status(201).json({ token, user: safe });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await db.findUserByEmail(email);
    if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign({ id: user.id, pending2FA: true }, JWT_SECRET, { expiresIn: '5m' });
      return res.json({ requires2FA: true, tempToken });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, twoFactorSecret: __, ...safe } = user;
    res.json({ token, user: safe });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Verify 2FA during login
router.post('/verify-2fa', async (req: Request, res: Response) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) return res.status(400).json({ error: 'Token and code required' });

    const decoded = jwt.verify(tempToken, JWT_SECRET) as any;
    if (!decoded.pending2FA) return res.status(400).json({ error: 'Invalid token' });

    const user = await db.findUserById(decoded.id);
    if (!user || !user.twoFactorSecret) return res.status(400).json({ error: 'User not found' });
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });
    if (!verified) return res.status(401).json({ error: 'Invalid 2FA code' });
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, twoFactorSecret: __, ...safe } = user;
    res.json({ token, user: safe });
  } catch (e: any) {
    res.status(401).json({ error: 'Verification failed' });
  }
});

// Setup 2FA (requires auth)
router.post('/setup-2fa', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await db.findUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const secret = speakeasy.generateSecret({
      name: `TheFramedWall (${user.email})`,
      issuer: 'TheFramedWall',
    });
    await db.updateUser(user.id, { twoFactorSecret: secret.base32 });
    const qrUrl = await QRCode.toDataURL(secret.otpauth_url!);
    res.json({ secret: secret.base32, qrCode: qrUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Confirm 2FA setup
router.post('/confirm-2fa', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const user = await db.findUserById((req as any).userId);
    if (!user || !user.twoFactorSecret) return res.status(400).json({ error: 'Setup 2FA first' });
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });
    if (!verified) return res.status(401).json({ error: 'Invalid code. Try again.' });
    await db.updateUser(user.id, { twoFactorEnabled: true });
    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Disable 2FA
router.post('/disable-2fa', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const user = await db.findUserById((req as any).userId);
    if (!user || !user.twoFactorSecret) return res.status(400).json({ error: '2FA not enabled' });
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });
    if (!verified) return res.status(401).json({ error: 'Invalid code' });
    await db.updateUser(user.id, { twoFactorEnabled: false, twoFactorSecret: undefined });
    res.json({ success: true, message: '2FA disabled' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get current user profile
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const user = await db.findUserById((req as any).userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, twoFactorSecret: __, ...safe } = user;
  res.json(safe);
});

// Update profile
router.put('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const user = await db.findUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const patch: Partial<typeof user> = {};
    if (name) patch.name = name;
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      if (!user.password) return res.status(400).json({ error: 'Password not set (SSO account)' });
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
      patch.password = await bcrypt.hash(newPassword, 12);
    }
    const updated = await db.updateUser(user.id, patch);
    if (updated) {
      const { password: _, twoFactorSecret: __, ...safe } = updated;
      return res.json(safe);
    }
    res.status(500).json({ error: 'Update failed' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

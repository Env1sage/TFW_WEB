import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import * as db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendOtpSMS } from '../sms.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET not set'); process.exit(1); }


/* ── Send OTP ── */
router.post('/send-otp', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number' });
    }

    const bypass = process.env.OTP_BYPASS === 'true';
    const otp = bypass ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = uuid();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db.createOtpSession(sessionId, phone, otp, expiresAt);
    if (!bypass) await sendOtpSMS(phone, otp);

    res.json({ sessionId, message: 'OTP sent', ...(bypass && { bypassOtp: otp }) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to send OTP' });
  }
});

/* ── Verify OTP ── */
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { sessionId, otp } = req.body;
    if (!sessionId || !otp) return res.status(400).json({ error: 'Session ID and OTP are required' });

    const session = await db.findOtpSession(sessionId);
    if (!session) return res.status(400).json({ error: 'OTP expired or invalid. Please request a new one.' });
    if (session.otp !== String(otp).trim()) return res.status(401).json({ error: 'Incorrect OTP' });

    await db.markOtpVerified(sessionId);

    // Find or auto-create user
    let user = await db.findUserByPhone(session.phone);
    let isNewUser = false;
    if (!user) {
      const newId = uuid();
      await db.addUser({ id: newId, name: '', phone: session.phone, email: null, password: null, role: 'user', twoFactorEnabled: false });
      user = await db.findUserById(newId);
      isNewUser = true;
    }
    if (!user) return res.status(500).json({ error: 'User creation failed' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    const { password: _, twoFactorSecret: __, ...safe } = user;
    res.json({ token, user: safe, isNewUser });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Verification failed' });
  }
});

/* ── Admin email/password login (kept for admin portal only) ── */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await db.findUserByEmail(email);
    if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, twoFactorSecret: __, ...safe } = user;
    res.json({ token, user: safe });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Get current user profile ── */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await db.findUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, twoFactorSecret: __, ...safe } = user;
    res.json(safe);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Update profile ── */
router.put('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const user = await db.findUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const patch: Record<string, any> = {};
    if (name !== undefined) patch.name = name;
    if (email !== undefined) patch.email = email;
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      if (!user.password) return res.status(400).json({ error: 'Password not set' });
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
      patch.password = await bcrypt.hash(newPassword, 12);
    }
    const updated = await db.updateUser(user.id, patch);
    if (!updated) return res.status(500).json({ error: 'Update failed' });
    const { password: _, twoFactorSecret: __, ...safe } = updated;
    res.json(safe);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import * as db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendOtpSMS } from '../sms.js';
import { pool } from '../database.js';

export async function upsertLead(opts: { name?: string; mobile?: string; email?: string; source: string }) {
  const { name = '', mobile = '', email = '', source } = opts;
  try {
    if (email) {
      const { rows } = await pool.query('SELECT id FROM website_leads WHERE email = $1 LIMIT 1', [email]);
      if (rows.length) {
        await pool.query(`UPDATE website_leads SET last_activity = NOW(), updated_at = NOW(), source = CASE WHEN source = 'organic' THEN $1 ELSE source END, name = CASE WHEN name = '' AND $2 != '' THEN $2 ELSE name END, mobile = CASE WHEN mobile = '' AND $3 != '' THEN $3 ELSE mobile END WHERE id = $4`, [source, name, mobile, rows[0].id]);
        return;
      }
    }
    if (mobile) {
      const { rows } = await pool.query('SELECT id FROM website_leads WHERE mobile = $1 LIMIT 1', [mobile]);
      if (rows.length) {
        await pool.query(`UPDATE website_leads SET last_activity = NOW(), updated_at = NOW(), source = CASE WHEN source = 'organic' THEN $1 ELSE source END, name = CASE WHEN name = '' AND $2 != '' THEN $2 ELSE name END, email = CASE WHEN email = '' AND $3 != '' THEN $3 ELSE email END WHERE id = $4`, [source, name, email, rows[0].id]);
        return;
      }
    }
    if (!name && !mobile && !email) return;
    await pool.query(
      `INSERT INTO website_leads (id, name, mobile, email, source, products_viewed, status, last_activity, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,'[]','new',NOW(),NOW(),NOW()) ON CONFLICT DO NOTHING`,
      [uuid(), name, mobile, email, source]
    );
  } catch (e) { /* non-blocking: never fail the main request */ }
}

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

    // Capture lead (non-blocking)
    upsertLead({ mobile: session.phone, name: user.name || '', email: user.email || '', source: isNewUser ? 'registration' : 'login' });

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
    if (name || email) {
      upsertLead({ name: updated.name || '', email: updated.email || '', mobile: updated.phone || '', source: 'profile_update' });
    }
    const { password: _, twoFactorSecret: __, ...safe } = updated;
    res.json(safe);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

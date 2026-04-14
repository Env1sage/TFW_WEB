import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { v4 as uuid } from 'uuid';
import * as db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

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
  try {
    const user = await db.findUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, twoFactorSecret: __, ...safe } = user;
    res.json(safe);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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

// ── Google OAuth ──────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.APP_URL || 'https://theframedwall.com';
const GOOGLE_REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

// Initiates Google OAuth flow
router.get('/google', (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google sign-in is not configured' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  const stateSigned = jwt.sign({ state }, JWT_SECRET!, { expiresIn: '10m' });
  res.cookie('oauth_state', stateSigned, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Handles Google OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const CLIENT_ORIGIN = process.env.CLIENT_URL || 'https://theframedwall.com';
  try {
    const { code, state, error } = req.query as Record<string, string>;

    if (error || !code) {
      return res.redirect(`${CLIENT_ORIGIN}/auth/google/callback?error=${encodeURIComponent(error || 'access_denied')}`);
    }

    // Verify CSRF state
    const stateCookie = (req as any).cookies?.oauth_state;
    if (!stateCookie) throw new Error('State cookie missing');
    const decoded = jwt.verify(stateCookie, JWT_SECRET!) as any;
    if (decoded.state !== state) throw new Error('State mismatch');
    res.clearCookie('oauth_state', { path: '/' });

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error('OAuth not configured');

    // Exchange auth code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const tokens = await tokenRes.json() as any;

    // Fetch user profile from Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new Error('Profile fetch failed');
    const profile = await profileRes.json() as any;

    const { sub: googleId, email, name, picture } = profile;
    if (!googleId || !email) throw new Error('Incomplete profile from Google');

    // Find or create user
    let user = await db.findUserByGoogleId(googleId);
    if (!user) {
      // Check if an account with this email already exists — link it
      const existing = await db.findUserByEmail(email);
      if (existing) {
        await db.updateUser(existing.id, { googleId, avatar: existing.avatar || picture });
        user = await db.findUserById(existing.id);
      } else {
        const newId = uuid();
        await db.addUser({ id: newId, name, email, password: null, role: 'user', twoFactorEnabled: false, googleId, avatar: picture });
        user = await db.findUserById(newId);
      }
    }
    if (!user) throw new Error('User creation failed');

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET!, { expiresIn: '7d' });
    res.redirect(`${CLIENT_ORIGIN}/auth/google/callback?token=${token}`);
  } catch (e: any) {
    console.error('Google OAuth error:', e.message);
    res.redirect(`${CLIENT_ORIGIN}/auth/google/callback?error=oauth_failed`);
  }
});

export default router;

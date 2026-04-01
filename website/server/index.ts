import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { initDB, pool } from './database.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Trust first proxy (nginx) — required for express-rate-limit behind reverse proxy
app.set('trust proxy', 1);
const PORT = process.env.API_PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = [
  CLIENT_URL,
  'http://187.127.141.125',
  'http://theframedwall.com',
  'https://theframedwall.com',
  'http://www.theframedwall.com',
  'https://www.theframedwall.com',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many attempts, please try again after 15 minutes' } });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests, please slow down' } });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verify-2fa', authLimiter);
app.use('/api/products/corporate-inquiry', rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Too many inquiries, try again later' } }));
app.use('/api', apiLimiter);

// Serve uploaded files — in production __dirname is /app/dist/server, uploads are at /app/uploads
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'postgresql', connected: true });
  } catch {
    res.status(503).json({ status: 'error', db: 'postgresql', connected: false });
  }
});

// In production, serve the Vite-built React SPA
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client');
  app.use(express.static(clientDist));
  // SPA fallback — all non-API routes serve index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message || err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

// Process-level error handlers
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
  process.exit(1);
});

// Initialize PostgreSQL tables & seed, then start
initDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`API server running on http://localhost:${PORT} (PostgreSQL)`);
    });
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, closing gracefully...');
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

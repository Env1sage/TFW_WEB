import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { initDB, pool } from './database.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import collectionRoutes from './routes/collections.js';
import settingsRoutes from './routes/settings.js';
import leadsRoutes from './routes/leads.js';
import inventoryRoutes from './routes/inventory.js';
import backInStockRoutes from './routes/backInStock.js';
import brandsRoutes from './routes/brands.js';
import bannersRoutes from './routes/banners.js';
import shippingRoutes from './routes/shipping.js';
import deliveryRoutes from './routes/delivery.js';
import analyticsRoutes from './routes/analytics.js';
import abandonedCartsRoutes, { runAbandonedCartDrip } from './routes/abandonedCarts.js';

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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", 'blob:', 'https://checkout.razorpay.com', 'https://cdn.razorpay.com', 'https://checkout-static-next.razorpay.com'],
      workerSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'", 'blob:', 'https://api.razorpay.com', 'https://cdn.razorpay.com', 'https://lumberjack.razorpay.com', 'https://staticimgly.com', 'https://cdn.imgly.io', 'https://models.imgly.io'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
    },
  },
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
// Large-limit parsers must come BEFORE the global 1mb limit so they run first
app.use('/api/products/design-orders', express.json({ limit: '50mb' }));
app.use('/api/products/saved-designs', express.json({ limit: '50mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many attempts, please try again after 15 minutes' } });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests, please slow down' } });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/send-otp', authLimiter);
app.use('/api/products/corporate-inquiry', rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Too many inquiries, try again later' } }));
app.use('/api', apiLimiter);

// Serve uploaded files — in production __dirname is /app/dist/server, uploads are at /app/uploads
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/back-in-stock', backInStockRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/banners', bannersRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/abandoned-carts', abandonedCartsRoutes);

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

    // Abandoned cart drip cron — runs every 30 minutes
    setInterval(async () => {
      try { await runAbandonedCartDrip(); }
      catch (e) { console.error('[Drip] Cron error:', e); }
    }, 30 * 60 * 1000);
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

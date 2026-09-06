import express from 'express'; //index.js
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env from server/.env then server/src/.env (supports either location)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, './.env') });

const app = express();


// Validate critical environment variables (don't exit in Vercel - let it fail gracefully)
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = !!process.env.VERCEL;

if (!process.env.ADMIN_TOKEN) {
  console.error('⚠️  WARNING: ADMIN_TOKEN environment variable not set!');
  // Don't exit in Vercel - let requests fail gracefully
  if (isProduction && !isVercel) process.exit(1);
}
if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  console.error('⚠️  WARNING: Database configuration not set! Set DATABASE_URL or PGHOST');
  // Don't exit in Vercel - let requests fail gracefully
  if (isProduction && !isVercel) process.exit(1);
}

const port = process.env.PORT || 8080;
// Default allowed origins - include frontend domain if backend is separate
const defaultOrigins = [
  'http://localhost:8080',
  'http://localhost:3000'
];
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(o => o.length > 0)
  .concat(defaultOrigins); // Add default origins

const allowNoOrigin = process.env.ALLOW_NO_ORIGIN !== 'false' && !isProduction;

// Helper to check if origin is localhost
function isLocalhost(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname === '::1' ||
           hostname.startsWith('localhost:') ||
           hostname.startsWith('127.0.0.1:');
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, allowNoOrigin);
      if (allowedOrigins.includes(origin) || isLocalhost(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "x-user-token",
      "x-admin-token",
      "x-user-tokens",
      "x-request-owned"
    ],
    credentials: true
  })
);

app.use(express.json());

// Simple in-memory rate limiter (per IP) to protect API from abuse.
// NOTE: This is lightweight and fine for your current scale; for very high
// traffic you might move to Redis or a dedicated gateway later.
const apiRateBuckets = new Map();

function apiRateLimiter(req, res, next) {
  try {
    // Don't rate-limit health checks
    if (req.path === '/health') return next();

    const now = Date.now();
    const windowMs = 60_000; // 1 minute window
    const max = 60; // 60 requests / minute / IP (front-end uses ~6/min)

    const ip =
      req.ip ||
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      'unknown';

    let bucket = apiRateBuckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      apiRateBuckets.set(ip, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        status: 'error',
        message:
          'Çox tez-tez sorğu göndərirsiniz. Zəhmət olmasa bir az sonra yenidən cəhd edin.'
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

// Apply global API rate limit (covers reservations + admin endpoints)
app.use('/api', apiRateLimiter);

// API routes first (before static files)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint for debugging (only in Vercel - helps diagnose routing issues)
if (process.env.VERCEL) {
  app.get('/', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'Backend API is running',
      endpoints: ['/api/reservations', '/api/admin/verify', '/health'],
      path: req.path,
      url: req.url
    });
  });
}

// Import routes after env is loaded to ensure DB config is available
// Wrap in try-catch to handle initialization errors gracefully
let reservationsRouter = null;
try {
  const module = await import('./reservations.js');
  reservationsRouter = module.default;
  app.use('/api', reservationsRouter);
} catch (err) {
  console.error('Failed to load reservations router:', err);
  // Add a fallback route that returns an error
  app.use('/api', (req, res, next) => {
    res.status(500).json({ 
      status: 'error', 
      message: 'Server initialization error. Please check server logs.' 
    });
  });
}

// Serve static files from public folder (for local development only)
// In Vercel, static files are served separately via vercel.json
if (!process.env.VERCEL) {
  const publicPath = path.resolve(__dirname, '../../public');
  app.use(express.static(publicPath));

  // Admin dashboard lives on its own clean route, separate from the public site
  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(publicPath, 'dashboard.html'));
  });

  // Fallback: serve index.html for SPA routing (after API routes)
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}
// In Vercel, don't add catch-all route - let Vercel handle static files via vercel.json

// Stateless admin verification (no rate limiting in memory - can be added via external service if needed)
app.post('/api/admin/verify', (req, res) => {
  const provided = req.headers['x-admin-token'];
  const expected = process.env.ADMIN_TOKEN || '';

  if (provided && expected && provided === expected) {
    return res.json({ status: 'ok' });
  }

  return res.status(401).json({ status: 'error', message: 'Invalid admin code' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

// Graceful error handlers
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  if (isProduction) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server if running directly (not as Vercel serverless function)
if (!process.env.VERCEL) {
  const publicPath = path.resolve(__dirname, '../../public');
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📁 Serving static files from: ${publicPath}`);
    console.log(`🌐 Frontend: http://localhost:${port}`);
    console.log(`🔌 API: http://localhost:${port}/api`);
    console.log(`🔐 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  });
}

// Export for Vercel serverless function
// Vercel's @vercel/node builder automatically wraps Express apps
// The app will receive requests with the full path, so routes work as expected
export default app;
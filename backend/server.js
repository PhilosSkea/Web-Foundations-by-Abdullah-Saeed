/**
 * PRODUCTION-GRADE SECURE BACKEND
 * 
 * Security Features:
 * ✅ httpOnly session cookies (not localStorage)
 * ✅ CORS properly configured
 * ✅ Helmet for HTTP headers
 * ✅ Rate limiting on auth endpoints
 * ✅ Environment variable validation
 * ✅ Proper error handling (no stack traces to client)
 * ✅ Stripe webhook signature verification
 * ✅ Backend is source of truth for all pricing/access
 * 
 * Trust Boundary: ONLY BACKEND IS TRUSTED
 */

import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payment.js';
import articlesRoutes from './routes/articles.js';
import webhookRoutes from './routes/webhooks.js';

// Validate required environment variables
const requiredEnv = [
  'SESSION_SECRET',
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'FRONTEND_URL'
];

for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`❌ Missing required environment variable: ${env}`);
    process.exit(1);
  }
}

const app = express();

// SECURITY HEADERS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.stripe.com'],
      frameAncestors: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  xssFilter: true,
  noSniff: true
}));

// CORS - Restrict to frontend origin only
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
}));

// WEBHOOK ROUTE - Must be before body parser (Stripe needs raw body)
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRoutes);

// JSON PARSER
app.use(express.json({ limit: '10kb' })); // Limit payload size

// SESSION MANAGEMENT
// SECURITY: Using httpOnly cookies, not localStorage tokens
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// RATE LIMITING
// Auth endpoints are most sensitive
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 5), // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' // Skip in dev
});

// General API rate limiting (more permissive)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  skip: (req) => process.env.NODE_ENV === 'development'
});

// ROUTES
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/articles', apiLimiter, articlesRoutes);
app.use('/api/payment', apiLimiter, paymentRoutes);

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// 404 HANDLER
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// ERROR HANDLER
// SECURITY: Never expose stack traces to client
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Default error response
  const response = {
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An error occurred. Please try again.'
      : err.message
  };

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json(response);
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 BERLIN-BENZ BACKEND (PRODUCTION-GRADE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Server running on http://localhost:${PORT}
✅ Environment: ${process.env.NODE_ENV || 'development'}
✅ CORS enabled for: ${process.env.FRONTEND_URL}
✅ Helmet security headers active
✅ Session-based auth (httpOnly cookies)
✅ Rate limiting enabled
✅ Stripe webhooks ready
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;


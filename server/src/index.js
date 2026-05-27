// Set WebSocket polyfill for Node.js 20 compatibility - must be before any other imports
import ws from 'ws';
global.WebSocket = ws;
global.window = { WebSocket: ws };

import express from 'express';
import cors from 'cors';
import * as Sentry from '@sentry/node';

// Initialize Sentry before routes
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.user) delete event.user.mobile;
    if (event.extra) {
      delete event.extra.aadhaar;
      delete event.extra.upi_id;
    }
    return event;
  }
});

// Config and Logger imports
import { config } from './config/index.js';
import { securityHeaders } from './middleware/security.js';
import { requestLoggerMiddleware, logger } from './lib/logger.js';

// Middleware imports
import { generalApiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.js';
import vaultRoutes from './routes/vault.js';
import webhookRoutes from './routes/webhooks.js';
import chitfundRoutes from './routes/chitfund.js';
import lendingRoutes from './routes/lending.js';
import certificateRoutes from './routes/certificate.js';
import nudgeRoutes from './routes/nudges.js';

const app = express();
const PORT = config.port;
const CLIENT_URL = config.clientUrl;
const isProduction = config.nodeEnv === 'production';

// 1. Production Security & Logging Middlewares
app.use(securityHeaders);
app.use(requestLoggerMiddleware);

// Dynamic CORS configuration (Allows only CLIENT_URL origin)
app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Webhook routes mounted BEFORE express.json body parser to preserve raw body signature check
app.use('/api/webhooks', webhookRoutes);

// Lender disbursement webhook — separate path, also needs raw body handling
// Uses lendingRoutes sub-router; the /webhook-disburse endpoint validates via shared secret header
app.use('/api/lending', lendingRoutes);

// Payload constraint (Limit body sizes to 10kb to defend against payload exhaustion attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 2. Global Rate Limiting
app.use(generalApiLimiter);

// 3. System Health Checks
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 4. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/chitfund', chitfundRoutes);
// Note: /api/lending also mounted before body parser above for webhook support
app.use('/api/certificate', certificateRoutes);
app.use('/api/nudges', nudgeRoutes);

// 5. Unhandled routes fallback
app.use((req, res, next) => {
  const error = new Error('API resource not found');
  error.status = 404;
  error.code = 'RESOURCE_NOT_FOUND';
  next(error);
});

// 6. Global Exception Catcher (Must be last)
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

// Initialize Server Thread
const server = app.listen(PORT, () => {
  logger.info(`=================================================`);
  logger.info(`🚀 SafeKosh Production-Grade Server Online!`);
  logger.info(`📡 Port: ${PORT}`);
  logger.info(`🛡️  Security Headers: Custom Helmet Active`);
  logger.info(`🌐 CORS Allowed Origin: ${CLIENT_URL}`);
  logger.info(`=================================================`);
});

// 7. Graceful Termination & Resource Cleanups
const handleGracefulShutdown = (signal) => {
  logger.warn(`⚠️ Received ${signal}. Starting graceful shutdown sequence...`);
  
  // Stop receiving new connections
  server.close(() => {
    logger.info('🛑 HTTP Server threads terminated.');
    logger.info('✅ Graceful shutdown completed. Exiting process safely.');
    process.exit(0);
  });

  // Force close after 10 seconds if threads hang
  setTimeout(() => {
    logger.error('☠️ Force closing background tasks after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

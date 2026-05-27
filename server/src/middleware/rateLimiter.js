import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';

let redisClient;

// Connect to Upstash Redis for shared distributed rate limiting in production
if (process.env.UPSTASH_REDIS_URL && process.env.NODE_ENV !== 'test') {
  try {
    redisClient = new Redis(process.env.UPSTASH_REDIS_URL, {
      maxRetriesPerRequest: null,
      tls: {
        // Required for secure TLS connections with Upstash Redis endpoints
        rejectUnauthorized: false
      }
    });

    // Suppress unhandled error log crashes during connection retries
    redisClient.on('error', (err) => {
      // Swallows dns/network warnings if Upstash url is left as default mock placeholder
      console.warn(`⚠️ [Redis Client Warning]: ${err.message}`);
    });

    console.log('✅ Rate Limiting Redis Client successfully linked.');
  } catch (error) {
    console.error('❌ Failed to instantiate Redis client for rate limiting. Falling back to memory-store:', error);
  }
} else {
  console.warn('⚠️ UPSTASH_REDIS_URL is absent. Running rate limiting inside local MemoryStore.');
}

/**
 * Helper to bootstrap a rate limiter with standard HTTP headers and custom retry-after JSON responses
 */
const createLimiter = (prefix, options) => {
  let limiterStore;

  // Each rate limiter MUST receive its own RedisStore instance with a unique prefix to prevent ERR_ERL_STORE_REUSE
  if (redisClient) {
    limiterStore = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `safekosh-rl:${prefix}:`,
    });
  }

  return rateLimit({
    store: limiterStore || undefined, // defaults to local MemoryStore if store is not defined
    standardHeaders: true,     // return RateLimit-* status headers
    legacyHeaders: false,      // disable deprecated X-RateLimit-* headers
    handler: (req, res, next, options) => {
      // Find remaining window time if headers are available, or estimate
      const retryAfter = res.getHeader('Retry-After') || Math.ceil(options.windowMs / 1000);
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Number(retryAfter)
      });
    },
    ...options
  });
};

// 1. Auth routes (OTP send): 5 requests per 15 minutes per IP
export const authSendOtpLimiter = createLimiter('auth-send', {
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
});

// 2. Auth routes (OTP verify): 10 requests per 15 minutes per IP
export const authVerifyOtpLimiter = createLimiter('auth-verify', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
});

// 3. Vault operations: 30 requests per minute per user
export const vaultLimiter = createLimiter('vault', {
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
});

// 4. Certificate generate: 3 requests per day per user
export const certificateLimiter = createLimiter('cert', {
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user?.id || req.ip,
});

// 5. General API: 300 req/min in dev, 100 req/min in production
// /api/auth/me is called on every page load \u2014 skip it to avoid false 429s
export const generalApiLimiter = createLimiter('general', {
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 300,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.path === '/api/auth/me' || req.path.endsWith('/me'),
});


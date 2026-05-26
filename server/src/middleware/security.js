import helmet from 'helmet';
import config from '../config/index.js';

const isProduction = config.nodeEnv === 'production';

// Parse domains dynamically from configuration if available
const whitelistConnectSrc = ["'self'"];
if (config.supabase.url) {
  try {
    const origin = new URL(config.supabase.url).origin;
    whitelistConnectSrc.push(origin);
  } catch (e) {
    // Ignore invalid url
  }
}
whitelistConnectSrc.push('https://*.supabase.co');

if (config.blockchain.rpcUrl) {
  try {
    const origin = new URL(config.blockchain.rpcUrl).origin;
    whitelistConnectSrc.push(origin);
  } catch (e) {
    // Ignore invalid url
  }
}
whitelistConnectSrc.push('https://polygon-rpc.com');
whitelistConnectSrc.push('https://rpc-mainnet.maticvigil.com');
whitelistConnectSrc.push('https://*.polygon.technology');

// Razorpay & Cashfree API endpoints
whitelistConnectSrc.push('https://api.razorpay.com');
whitelistConnectSrc.push('https://api.cashfree.com');
whitelistConnectSrc.push('https://checkout.razorpay.com');
whitelistConnectSrc.push('https://sdk.cashfree.com');

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: whitelistConnectSrc,
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://sdk.cashfree.com", "https://*.razorpay.com", "https://*.cashfree.com"],
      frameAncestors: ["'none'"], // Disallow iframe embedding (DENY frame)
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  frameguard: {
    action: 'deny',
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  hsts: isProduction
    ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      }
    : false, // Only active in production to prevent blocking local testing
  dnsPrefetchControl: {
    allow: false,
  },
  noSniff: true, // X-Content-Type-Options: nosniff
});

export default securityHeaders;

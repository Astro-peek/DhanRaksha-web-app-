import 'dotenv/config';

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'POLYGON_RPC_URL',
  'DEPLOYER_PRIVATE_KEY',
  'UPSTASH_REDIS_URL'
];

const isProduction = process.env.NODE_ENV === 'production';

// In production, validate that all required environment variables are present
if (isProduction) {
  const missingVars = REQUIRED_ENV_VARS.filter(envVar => !process.env[envVar]);
  if (missingVars.length > 0) {
    throw new Error(
      `[Config Error] Critical environment variables are missing in production mode: ${missingVars.join(', ')}`
    );
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET
  },
  blockchain: {
    rpcUrl: process.env.POLYGON_RPC_URL,
    deployerPrivateKey: process.env.DEPLOYER_PRIVATE_KEY,
    chitEscrowContractAddress: process.env.CHIT_ESCROW_CONTRACT_ADDRESS,
    certificateRegistryAddress: process.env.CERTIFICATE_REGISTRY_ADDRESS
  },
  redis: {
    url: process.env.UPSTASH_REDIS_URL,
    token: process.env.UPSTASH_REDIS_TOKEN
  }
};

export default config;

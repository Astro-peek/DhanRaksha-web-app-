import { jest } from '@jest/globals';

// Set dummy environment variables to avoid validation/initialization errors
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
process.env.POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-amoy.g.alchemy.com/v2/mock';
process.env.DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
process.env.UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL || 'rediss://default:mock@mock.upstash.io:6379';

const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation(function(onFulfilled) {
    return Promise.resolve({ data: [], count: 0, error: null }).then(onFulfilled);
  }),
  maybeSingle: jest.fn().mockResolvedValue({
    data: {
      id: '00000000-0000-0000-0000-000000000000',
      user_id: '00000000-0000-0000-0000-000000000000',
      organiser_id: '00000000-0000-0000-0000-000000000000',
      balance: 500,
      daily_saved_today: 100,
      daily_limit: 500,
      mandate_status: 'active',
      current_cycle: 1,
      name: 'Weekly Saver',
      status: 'forming',
      invite_token: '00000000-0000-0000-0000-000000000000',
      mobile: '9876543210',
      onboarding_completed: true,
      upi_id: 'test@upi',
      member_count: 5,
      contribution_per_member: 1000
    },
    error: null
  }),
  single: jest.fn().mockResolvedValue({
    data: {
      id: '00000000-0000-0000-0000-000000000000',
      user_id: '00000000-0000-0000-0000-000000000000',
      organiser_id: '00000000-0000-0000-0000-000000000000',
      balance: 500,
      daily_saved_today: 100,
      daily_limit: 500,
      mandate_status: 'active',
      current_cycle: 1,
      name: 'Weekly Saver',
      status: 'forming',
      invite_token: '00000000-0000-0000-0000-000000000000',
      mobile: '9876543210',
      onboarding_completed: true,
      upi_id: 'test@upi',
      member_count: 5,
      contribution_per_member: 1000
    },
    error: null
  })
};

export const supabaseAdmin = {
  from: jest.fn().mockReturnValue(mockChain),
  auth: {
    admin: {
      deleteUser: jest.fn().mockResolvedValue({ error: null })
    },
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null })
  }
};

export default supabaseAdmin;

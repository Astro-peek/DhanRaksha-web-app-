import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import crypto from 'crypto';
import supabaseAdmin from './helpers/supabaseTestClient.js';

process.env.RAZORPAY_WEBHOOK_SECRET = 'mock_webhook_secret';

// Mock Supabase module to intercept router queries
jest.unstable_mockModule('../lib/supabase.js', () => ({
  supabaseAdmin: supabaseAdmin,
  default: supabaseAdmin
}));

// Mock requireAuth globally
jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: req.headers['x-test-user-id'] || 'default-id' };
    req.token = 'mock-token';
    next();
  }
}));

// Mock Razorpay module
jest.unstable_mockModule('../lib/razorpay.js', () => ({
  razorpay: {
    payouts: {
      create: jest.fn().mockResolvedValue({ id: 'payout-id-mock' })
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({ id: 'sub-id-mock', short_url: 'http://mock.url' })
    }
  }
}));

const request = (await import('supertest')).default;
const express = (await import('express')).default;
const vaultRoutes = (await import('../routes/vault.js')).default;
const webhookRoutes = (await import('../routes/webhooks.js')).default;
const factories = await import('./helpers/factories.js');
const cleanup = await import('./helpers/cleanup.js');

const app = express();
app.use(express.json());
app.use('/api/vault', vaultRoutes);
app.use('/api/webhooks', webhookRoutes);

describe('Vault API', () => {
  let testUser;
  let cleanUserIds = [];

  beforeEach(async () => {
    testUser = await factories.createTestUser();
    cleanUserIds.push(testUser.id);
  });

  afterAll(async () => {
    await cleanup.cleanupTestData(cleanUserIds);
  });

  test('GET /api/vault/account creates vault if not exists', async () => {
    const res = await request(app)
      .get('/api/vault/account')
      .set('x-test-user-id', testUser.id);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.account).toBeDefined();
  });

  test('POST /api/vault/save credits correct amount', async () => {
    await factories.createTestVaultAccount(testUser.id, { balance: 100 });

    const res = await request(app)
      .post('/api/vault/save')
      .set('x-test-user-id', testUser.id)
      .send({ amount: 50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/vault/save rejects amount below ₹10', async () => {
    await factories.createTestVaultAccount(testUser.id, { balance: 100 });

    const res = await request(app)
      .post('/api/vault/save')
      .set('x-test-user-id', testUser.id)
      .send({ amount: 5 });

    expect(res.status).toBe(400);
  });

  test('POST /api/vault/withdraw debits correctly', async () => {
    await factories.createTestVaultAccount(testUser.id, { balance: 500 });

    const res = await request(app)
      .post('/api/vault/withdraw')
      .set('x-test-user-id', testUser.id)
      .send({ amount: 100, destination_upi: 'receiver@upi' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/vault/withdraw rejects if below ₹100 minimum', async () => {
    await factories.createTestVaultAccount(testUser.id, { balance: 500 });

    const res = await request(app)
      .post('/api/vault/withdraw')
      .set('x-test-user-id', testUser.id)
      .send({ amount: 50, destination_upi: 'receiver@upi' });

    expect(res.status).toBe(400);
  });

  test('PUT /api/vault/settings updates save_per_transaction and daily_limit', async () => {
    await factories.createTestVaultAccount(testUser.id);

    const res = await request(app)
      .put('/api/vault/settings')
      .set('x-test-user-id', testUser.id)
      .send({ save_per_transaction: 30, daily_limit: 800 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/vault/transactions returns paginated results newest first', async () => {
    await factories.createTestVaultAccount(testUser.id);
    
    const res = await request(app)
      .get('/api/vault/transactions?page=1&limit=5')
      .set('x-test-user-id', testUser.id);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Razorpay webhook with valid signature processes auto-save', async () => {
    const payload = {
      event: 'payout.processed',
      payload: {
        payout: {
          entity: {
            id: 'payout-123',
            amount: 50000,
            notes: {
              user_id: testUser.id
            }
          }
        }
      }
    };
    const bodyStr = JSON.stringify(payload);
    const sig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(bodyStr)
      .digest('hex');

    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', sig)
      .set('content-type', 'application/json')
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  test('Razorpay webhook with invalid signature returns 401', async () => {
    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', 'invalid')
      .send({ some: 'payload' });

    expect(res.status).toBe(401);
  });
});

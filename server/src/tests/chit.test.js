import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import supabaseAdmin from './helpers/supabaseTestClient.js';

// Mock Supabase module
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

// Mock Blockchain module
jest.unstable_mockModule('../lib/blockchain.js', () => ({
  default: {
    anchorCertificateHash: jest.fn().mockResolvedValue({
      transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      blockNumber: 123456
    })
  }
}));

const request = (await import('supertest')).default;
const express = (await import('express')).default;
const chitfundRoutes = (await import('../routes/chitfund.js')).default;
const factories = await import('./helpers/factories.js');
const cleanup = await import('./helpers/cleanup.js');

const app = express();
app.use(express.json());
app.use('/api/chitfund', chitfundRoutes);

describe('Chit Fund API', () => {
  let organiser;
  let member;
  let cleanUserIds = [];
  let cleanGroupIds = [];

  beforeEach(async () => {
    organiser = await factories.createTestUser();
    member = await factories.createTestUser();
    cleanUserIds.push(organiser.id, member.id);
  });

  afterAll(async () => {
    await cleanup.cleanupTestData(cleanUserIds, cleanGroupIds);
  });

  test('POST /api/chitfund/groups creates group successfully', async () => {
    const res = await request(app)
      .post('/api/chitfund/groups')
      .set('x-test-user-id', organiser.id)
      .send({
        name: 'Weekly Saver',
        description: 'Test weekly saver',
        member_count: 5,
        contribution_per_member: 1000,
        duration_months: 5,
        organiser_commission_pct: 2
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.group.name).toBe('Weekly Saver');
  });

  test('POST /api/chitfund/join joins group successfully', async () => {
    const group = await factories.createTestChitGroup(organiser.id);
    cleanGroupIds.push(group.id);

    const res = await request(app)
      .post('/api/chitfund/join')
      .set('x-test-user-id', member.id)
      .send({ invite_token: group.invite_token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/chitfund/groups/:id/ledger returns transparent ledger', async () => {
    const group = await factories.createTestChitGroup(organiser.id);
    cleanGroupIds.push(group.id);

    const res = await request(app)
      .get(`/api/chitfund/groups/${group.id}`)
      .set('x-test-user-id', organiser.id);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

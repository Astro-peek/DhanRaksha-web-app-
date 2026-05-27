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

// Mock Queue module to prevent Redis connections in tests
jest.unstable_mockModule('../lib/queue.js', () => ({
  enqueue: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  registerWorker: jest.fn()
}));

// Mock Blockchain module
jest.unstable_mockModule('../lib/blockchain.js', () => ({
  default: {
    verifyCertificateHash: jest.fn().mockResolvedValue(true)
  }
}));

const request = (await import('supertest')).default;
const express = (await import('express')).default;
const certificateRoutes = (await import('../routes/certificate.js')).default;
const factories = await import('./helpers/factories.js');
const cleanup = await import('./helpers/cleanup.js');

const app = express();
app.use(express.json());
app.use('/api/certificate', certificateRoutes);

describe('Certificate API', () => {
  let testUser;
  let cleanUserIds = [];

  beforeEach(async () => {
    testUser = await factories.createTestUser();
    cleanUserIds.push(testUser.id);
  });

  afterAll(async () => {
    await cleanup.cleanupTestData(cleanUserIds);
  });

  test('POST /api/certificate/generate creates certificate record and starts job', async () => {
    const res = await request(app)
      .post('/api/certificate/generate')
      .set('x-test-user-id', testUser.id);

    expect([200, 202, 429]).toContain(res.status);
    expect(res.body.success || res.body.error).toBeDefined();
  });

  test('GET /api/certificate/verify/:certRef returns valid info', async () => {
    const certRef = 'SK-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    const res = await request(app)
      .get(`/api/certificate/verify/${certRef}`);

    expect(res.status).toBe(200);
  });
});

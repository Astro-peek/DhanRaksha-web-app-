import { jest, describe, test, expect } from '@jest/globals';
import supabaseAdmin from './helpers/supabaseTestClient.js';

// Mock Supabase module
jest.unstable_mockModule('../lib/supabase.js', () => ({
  supabaseAdmin: supabaseAdmin,
  default: supabaseAdmin
}));

const request = (await import('supertest')).default;
const express = (await import('express')).default;
const { requireAuth } = await import('../middleware/auth.js');
const authRouter = (await import('../routes/auth.js')).default;

// Setup isolated app for middleware tests
const app = express();
app.use(express.json());

app.get('/test-secure', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.use('/api/auth', authRouter);

describe('Auth API & Middleware', () => {


  test('Auth middleware rejects requests without Bearer token', async () => {
    const res = await request(app)
      .get('/test-secure');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  test('Auth middleware rejects expired/invalid tokens', async () => {
    // Mock supabaseAdmin auth check to fail
    jest.spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValueOnce({
      data: { user: null },
      error: new Error('Token expired')
    });

    const res = await request(app)
      .get('/test-secure')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});

import express from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { 
  authSendOtpLimiter, 
  authVerifyOtpLimiter, 
  generalApiLimiter 
} from '../middleware/rateLimiter.js';

const router = express.Router();

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

const sendOtpSchema = z.object({
  mobile: z.string()
    .length(10, 'Mobile number must be exactly 10 digits')
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number format')
});

const verifyOtpSchema = z.object({
  mobile: z.string()
    .length(10, 'Mobile number must be exactly 10 digits')
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number format'),
  otp: z.string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must be numerical')
});

const refreshSessionSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required')
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  language: z.enum(['hi', 'mr', 'te', 'ta', 'en']).optional(),
  upi_id: z.string()
    .regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format (e.g. user@bank)')
    .optional(),
  user_type: z.enum(['gig_worker', 'chit_organiser', 'chit_member', 'mixed']).optional(),
  fcm_token: z.string().max(255).optional()
});

// Helper for auditable database logging
const logAudit = async (userId, action, data = {}, req) => {
  try {
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action,
      table_name: 'users',
      new_data: {
        ...data,
        path: req.originalUrl,
        method: req.method
      },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null
    });
  } catch (err) {
    console.error(`[Audit Log Fail] action: ${action} - Error:`, err.message);
  }
};

// ==========================================
// ROUTES
// ==========================================

/**
 * POST /api/auth/send-otp
 * Trigger phone-OTP magiclink via SMS
 */
router.post('/send-otp', authSendOtpLimiter, validate(sendOtpSchema), async (req, res, next) => {
  const { mobile } = req.body;
  const fullPhone = `+91${mobile}`;

  try {
    // Invoke Supabase SMS Auth trigger
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      phone: fullPhone
    });

    if (error) {
      // Keep errors opaque to client but log internally
      console.error(`[OTP Send Fail] for phone ${fullPhone}:`, error.message);
      return res.status(400).json({ 
        error: 'Failed to initiate OTP check. Please verify your mobile number.' 
      });
    }

    // Log to audit log
    await logAudit(null, 'otp_requested', { mobile: `+91******${mobile.slice(-4)}` }, req);

    return res.json({ 
      success: true, 
      message: `OTP sent successfully to +91******${mobile.slice(-4)}` 
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify phone-OTP credentials and create user records
 */
router.post('/verify-otp', authVerifyOtpLimiter, validate(verifyOtpSchema), async (req, res, next) => {
  const { mobile, otp } = req.body;
  const fullPhone = `+91${mobile}`;

  try {
    // 1. Verify OTP with Supabase
    const { data: sessionData, error: verifyErr } = await supabaseAdmin.auth.verifyOtp({
      phone: fullPhone,
      token: otp,
      type: 'sms'
    });

    if (verifyErr || !sessionData?.user) {
      return res.status(401).json({ 
        error: 'Invalid or expired OTP', 
        code: 'OTP_INVALID' 
      });
    }

    const userId = sessionData.user.id;

    // 2. Query public.users table to verify profile exists
    let { data: userProfile, error: queryErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (queryErr) {
      console.error('[Verify OTP] Profile fetch error:', queryErr.message);
    }

    // 3. Fail-safe: Create user profile if trigger hasn't completed it yet
    if (!userProfile) {
      console.warn(`[Verify OTP] Profile not found for ${userId}. Creating profile fallback...`);
      const { data: newProfile, error: insertErr } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          mobile: mobile
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[Verify OTP] Profile fallback insert failed:', insertErr.message);
        return res.status(500).json({ error: 'Failed to construct user profile ledger' });
      }
      userProfile = newProfile;
    }

    // 4. Log login audit trail
    await logAudit(userId, 'login_success', {}, req);

    // 5. Respond with full authentication context
    return res.json({
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at
      },
      user: {
        id: userProfile.id,
        mobile: userProfile.mobile,
        name: userProfile.name || null,
        language: userProfile.language,
        user_type: userProfile.user_type,
        onboarding_completed: userProfile.onboarding_completed,
        upi_id: userProfile.upi_id || null
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh expired session keys
 */
router.post('/refresh', generalApiLimiter, validate(refreshSessionSchema), async (req, res, next) => {
  const { refresh_token } = req.body;

  try {
    const { data: refreshData, error: refreshErr } = await supabaseAdmin.auth.refreshSession({
      refresh_token
    });

    if (refreshErr || !refreshData?.session) {
      return res.status(401).json({ 
        error: 'Session refresh credentials have expired. Please login again.',
        code: 'SESSION_EXPIRED'
      });
    }

    return res.json({
      session: {
        access_token: refreshData.session.access_token,
        refresh_token: refreshData.session.refresh_token,
        expires_at: refreshData.session.expires_at
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Sign out session globally
 */
router.post('/logout', requireAuth, generalApiLimiter, async (req, res, next) => {
  try {
    // Revoke token globally
    const { error: signOutErr } = await supabaseAdmin.auth.admin.signOut(req.token);

    if (signOutErr) {
      console.error('[Logout Exception]:', signOutErr.message);
    }

    // Log to audit log
    await logAudit(req.user.id, 'logout', {}, req);

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Retrieve full verified context including Vault limits, Chit pools and Certificate status
 */
router.get('/me', requireAuth, generalApiLimiter, async (req, res, next) => {
  try {
    // 1. Fetch core user profile
    const { data: userProfile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (profileErr || !userProfile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // 2. Fetch Vault mandate status
    const { data: vaultAccount } = await supabaseAdmin
      .from('vault_accounts')
      .select('mandate_status')
      .eq('user_id', req.user.id)
      .maybeSingle();

    // 3. Fetch count of active Chit memberships
    const { count: activeChitCount } = await supabaseAdmin
      .from('chit_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('status', 'active');

    // 4. Fetch status of the latest generated Income Certificate
    const { data: latestCertificate } = await supabaseAdmin
      .from('income_certificates')
      .select('status')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Combine everything into a premium unified user object
    return res.json({
      ...userProfile,
      vault_status: vaultAccount?.mandate_status || 'inactive',
      active_chit_count: activeChitCount || 0,
      latest_certificate_status: latestCertificate?.status || null
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/auth/profile
 * Edit profile fields
 */
router.put('/profile', requireAuth, generalApiLimiter, validate(updateProfileSchema), async (req, res, next) => {
  const updates = req.body;

  try {
    const { data: updatedUser, error: updateErr } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (updateErr) {
      console.error('[Update Profile Error]:', updateErr.message);
      return res.status(400).json({ error: 'Failed to update profile changes' });
    }

    // Log the profile update
    await logAudit(req.user.id, 'profile_updated', updates, req);

    return res.json({
      success: true,
      user: {
        id: updatedUser.id,
        mobile: updatedUser.mobile,
        name: updatedUser.name || null,
        language: updatedUser.language,
        user_type: updatedUser.user_type,
        onboarding_completed: updatedUser.onboarding_completed,
        upi_id: updatedUser.upi_id || null
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/complete-onboarding
 * Verify settings and initialize a default savings locker
 */
router.post('/complete-onboarding', requireAuth, generalApiLimiter, async (req, res, next) => {
  try {
    // 1. Fetch profile to check requirements
    const { data: userProfile, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (fetchErr || !userProfile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // 2. Validate that Onboarding fields are not null or empty strings
    if (!userProfile.name || !userProfile.language || !userProfile.upi_id) {
      return res.status(400).json({ 
        error: 'Onboarding requirements not met. Name, preferred language, and UPI ID are required.' 
      });
    }

    // 3. Mark onboarding completed
    const { data: updatedUser, error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ onboarding_completed: true })
      .eq('id', req.user.id)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to complete onboarding state modification' });
    }

    // 4. Create Vault Account if it doesn't exist yet
    const { data: existingVault } = await supabaseAdmin
      .from('vault_accounts')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!existingVault) {
      const { error: vaultErr } = await supabaseAdmin
        .from('vault_accounts')
        .insert({
          user_id: req.user.id,
          balance: 0.00,
          save_per_transaction: 20.00,
          daily_limit: 500.00
        });

      if (vaultErr) {
        console.error('[Onboarding Vault Error]:', vaultErr.message);
        // Continue regardless of vault account initialization failure (can be resolved in vault settings)
      }
    }

    // 5. Log onboarding success
    await logAudit(req.user.id, 'onboarding_completed', {}, req);

    return res.json({
      success: true,
      user: {
        id: updatedUser.id,
        mobile: updatedUser.mobile,
        name: updatedUser.name || null,
        language: updatedUser.language,
        user_type: updatedUser.user_type,
        onboarding_completed: updatedUser.onboarding_completed,
        upi_id: updatedUser.upi_id || null
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

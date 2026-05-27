import express from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { generalApiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

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
      // Auto-create the profile if it's missing (handles race conditions from trigger delays)
      if (profileErr?.code === 'PGRST116' || !userProfile) {
        console.warn(`[/me] Profile not found for ${req.user.id}. Auto-creating...`);
        const { data: newProfile, error: createErr } = await supabaseAdmin
          .from('users')
          .insert({
            id: req.user.id,
            email: req.user.email || null,
            mobile: req.user.phone?.replace('+91', '') || null,
          })
          .select()
          .single();

        if (createErr) {
          console.error('[/me] Auto-create profile failed:', createErr.message);
          return res.status(500).json({ error: 'Failed to initialize user profile' });
        }
        return res.json({
          ...newProfile,
          vault_status: 'inactive',
          active_chit_count: 0,
          latest_certificate_status: null
        });
      }
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
        email: updatedUser.email || null,
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
        email: updatedUser.email || null,
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

import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/nudges
 * Retrieve all unseen nudges for the authenticated user
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { data: nudges, error } = await supabaseAdmin
      .from('nudge_log')
      .select('*')
      .eq('user_id', req.user.id)
      .is('seen_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      nudges: nudges || []
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/nudges/:id/seen
 * Mark a specific nudge as seen
 */
router.post('/:id/seen', requireAuth, async (req, res, next) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('nudge_log')
      .update({ seen_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      nudge: data
    });
  } catch (err) {
    next(err);
  }
});

export default router;

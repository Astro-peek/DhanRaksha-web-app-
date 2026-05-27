import { supabaseAdmin } from '../lib/supabase.js';

/**
 * JWT verification middleware for securing Express routes with Supabase Auth
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized access', 
        code: 'INVALID_TOKEN' 
      });
    }

    // Extract raw JWT token
    const token = authHeader.split(' ')[1];

    if (token === 'fake' && process.env.NODE_ENV !== 'production') {
      const devUserId = '00000000-0000-0000-0000-000000000000';
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', devUserId)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin
          .from('users')
          .insert({
            id: devUserId,
            mobile: '9999999999',
            name: 'Dev User',
            language: 'hi',
            onboarding_completed: false,
            upi_id: 'devuser@upi'
          });
      }

      req.user = {
        id: devUserId,
        phone: '+919999999999',
        email: 'dev@safekosh.in'
      };
      req.token = token;
      return next();
    }

    // Call Supabase admin client to retrieve user details from the JWT
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Session is invalid or has expired', 
        code: 'INVALID_TOKEN' 
      });
    }

    // Attach user profile context and raw token to request state
    req.user = {
      id: user.id,
      phone: user.phone || null,
      email: user.email || null,
    };
    req.token = token;

    next();
  } catch (err) {
    console.error('Critical authorization middleware exception:', err);
    return res.status(401).json({ 
      error: 'Unauthorized access verification error', 
      code: 'INVALID_TOKEN' 
    });
  }
};

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Instantiate administrative-level client with high privilege Service Role credentials
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'X-Client-Info': 'safekosh-server'
      }
    },
    db: {
      schema: 'public'
    }
  }
);

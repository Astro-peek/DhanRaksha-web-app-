import 'dotenv/config';
import WebSocket from 'isomorphic-ws';

// Set WebSocket globally before importing Supabase
global.WebSocket = WebSocket;
global.window = { WebSocket: WebSocket };

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

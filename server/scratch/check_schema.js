import 'dotenv/config';
import { supabaseAdmin } from '../src/lib/supabase.js';

async function main() {
  try {
    const { data, error } = await supabaseAdmin
      .from('nudge_log')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error fetching nudge_log:', error);
      return;
    }
    
    console.log('Columns in nudge_log:');
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
      console.log('Sample row:', data[0]);
    } else {
      console.log('No rows in nudge_log to inspect.');
    }
  } catch (err) {
    console.error('Execution error:', err);
  }
}

main();

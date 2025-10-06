// List recent items in public.items using SUPABASE_SERVICE_ROLE_KEY
// Usage: node scripts/list-recent-items.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('id,user_id,raw_text,bucket,status,created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('Query error:', error);
      process.exit(2);
    }
    console.log('Recent items:');
    console.dir(data, { depth: 2 });
  } catch (e) {
    console.error('Error:', e);
    process.exit(3);
  }
}

main();

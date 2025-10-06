// Simple script to verify server-side item creation using SUPABASE_SERVICE_ROLE_KEY
// Usage: node scripts/check-item-create.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env.local explicitly so local development envs are picked up
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.');
  console.error('Currently read:', {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
  });
  console.error('Make sure .env.local contains these values or export them in your shell.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  try {
    const { data: userData } = await supabase.auth.admin.listUsers();
    // admin.listUsers may return { users: [...] } or an array directly depending on client
    const users = (userData && (userData.users || userData)) || [];
    const testUserId = process.env.TEST_USER_ID || (Array.isArray(users) && users.length ? users[0].id : null);

    if (!testUserId) {
      console.error('\nNo test user id found. Provide a TEST_USER_ID env var or create a user in Supabase Auth and re-run.');
      console.error('Example: TEST_USER_ID=<the-user-uuid> node scripts/check-item-create.js');
      process.exit(1);
    }

    const toInsert = {
      user_id: testUserId || null,
      raw_text: 'CI test item from scripts/check-item-create.js ' + new Date().toISOString(),
      bucket: 'Note'
    };

    const { data: insertData, error: insertErr } = await supabase.from('items').insert(toInsert).select().single();
    if (insertErr) {
      console.error('Insert error:', insertErr);
      process.exit(2);
    }
    console.log('Inserted item:', insertData);

    const { data: items } = await supabase.from('items').select('id,raw_text,bucket,created_at').order('created_at', { ascending: false }).limit(5);
    console.log('Recent items:', items);
  } catch (e) {
    console.error('Error:', e);
    process.exit(3);
  }
}

main();

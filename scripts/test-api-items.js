import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

async function run() {
  try {
    const res = await fetch(`${API_BASE}/api/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_text: 'hi' }) });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      console.error('Test failed: response was not JSON');
      console.error('Status:', res.status);
      console.error('Body:', text.slice(0, 2000));
      process.exit(1);
    }

    console.log('Response:', json);
    if (json.error === 'Not authenticated') {
      console.log('Test passed: unauthenticated POST rejected');
      process.exit(0);
    } else {
      console.error('Test failed: unexpected response');
      process.exit(2);
    }
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  }
}

run();

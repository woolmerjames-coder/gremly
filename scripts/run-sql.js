#!/usr/bin/env node
// Simple migration runner: reads SQL files from supabase/ and applies them to a DATABASE_URL using `pg`.
// Usage:
//   # dry run (prints SQL files to stdout)
//   node scripts/run-sql.js --dry
//   # apply (requires DATABASE_URL env var set)
//   DATABASE_URL=postgres://... node scripts/run-sql.js

import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.join(new URL(import.meta.url).pathname, '..', 'supabase');

function readSqlFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => ({ name: f, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8') }));
}

async function run() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry') || args.includes('-d');
  const files = readSqlFiles();

  if (files.length === 0) {
    console.log('No .sql files found in supabase/. Nothing to do.');
    return;
  }

  console.log(`Found ${files.length} SQL file(s) in supabase/:`);
  files.forEach(f => console.log(' -', f.name));

  if (dry) {
    console.log('\n--- DRY RUN: SQL output ---\n');
    files.forEach(f => {
      console.log(`-- ${f.name}\n`);
      console.log(f.sql);
      console.log('\n');
    });
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Aborting. For a dry run use --dry.');
    process.exitCode = 2;
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    for (const f of files) {
      console.log(`Applying ${f.name}...`);
      await client.query('BEGIN');
      try {
        await client.query(f.sql);
        await client.query('COMMIT');
        console.log(`Applied ${f.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to apply ${f.name}:`, err.message || err);
        throw err;
      }
    }
    console.log('All migrations applied successfully.');
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error('Migration runner failed:', err && err.message ? err.message : err);
  process.exitCode = 1;
});

How to create the `items` table in Supabase

1) Open your Supabase project dashboard -> SQL Editor -> New query.
2) Paste the contents of `001_create_items_table.sql` and run it.

What this does:
- Creates `public.items` with columns: id, user_id, raw_text, bucket, created_at.
- Enables Row Level Security (RLS).
- Adds policies that let authenticated users insert/select/update/delete only their own rows.

Testing in Supabase SQL editor (as an authenticated user):
- Try inserting a row using the API key or from the client; insertion should set `user_id` to your auth uid.
- To inspect auth.uid(), run `select auth.uid()` from a SQL editor tab opened from the SQL editor while signed in.

If your project doesn't support `pgcrypto`, change `gen_random_uuid()` to `uuid_generate_v4()` and enable the
`uuid-ossp` extension instead.

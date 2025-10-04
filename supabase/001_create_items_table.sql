-- Create `items` table for Brain Dump app
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query) or via psql.

-- Ensure we have a uuid generator available. Supabase projects usually allow pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Table
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  raw_text text NOT NULL,
  bucket text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Policies: allow users to operate only on their own rows (owner = auth.uid())
-- Note: auth.uid() returns the current user's id as text; cast to uuid to compare with user_id
CREATE POLICY "Users can select their own rows" ON public.items
  FOR SELECT USING (user_id = auth.uid()::uuid);

CREATE POLICY "Users can insert their own rows" ON public.items
  FOR INSERT WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "Users can update their own rows" ON public.items
  FOR UPDATE USING (user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "Users can delete their own rows" ON public.items
  FOR DELETE USING (user_id = auth.uid()::uuid);

-- Grant the authenticated role access (optional but common in Supabase projects)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;

COMMIT;

-- Notes:
-- - If your Supabase project's postgres does not allow pgcrypto, replace gen_random_uuid() with uuid_generate_v4()
--   and enable the "uuid-ossp" extension instead.

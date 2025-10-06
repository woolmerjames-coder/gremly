-- Idempotent migration: create conversations/messages, extend items, add RLS policies, grants, and FK
-- Safe to paste & run in the Supabase SQL editor (it uses DROP ... IF EXISTS before CREATE where needed).

BEGIN;

-- extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Extend items table with columns if they don't exist
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_conversation uuid;

-- Enable RLS (idempotent)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies: drop if they exist, then (re)create so this is idempotent
DROP POLICY IF EXISTS "Users can manage their conversations" ON public.conversations;
CREATE POLICY "Users can manage their conversations" ON public.conversations
  FOR ALL
  USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);

DROP POLICY IF EXISTS "Users can manage their messages" ON public.messages;
CREATE POLICY "Users can manage their messages" ON public.messages
  FOR ALL
  USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);

-- Grants to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;

-- Ensure items.source_conversation FK exists (drop then add for idempotence)
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_source_conversation_fkey;
ALTER TABLE public.items
  ADD CONSTRAINT items_source_conversation_fkey
    FOREIGN KEY (source_conversation)
    REFERENCES public.conversations(id) ON DELETE SET NULL;

COMMIT;

-- Notes:
-- 1) Paste the contents of this file into the Supabase SQL editor (https://app.supabase.com/project/<your-project>/sql) and run.
-- 2) The script is idempotent and safe to run multiple times.
-- 3) If your `items` table doesn't exist yet, ensure `supabase/001_create_items_table.sql` has been applied first.


-- Create conversations and messages tables, and extend items for task metadata
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Messages table (persist chat history)
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Extend items to support status, due_date, completed_at, priority, source_conversation
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_conversation uuid;

-- Enable RLS on conversations and messages
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their conversations" ON public.conversations
  FOR ALL USING (user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "Users can manage their messages" ON public.messages
  FOR ALL USING (user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid);

-- Grant authenticated role access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;

COMMIT;

-- Notes: run this after 001_create_items_table.sql is applied.

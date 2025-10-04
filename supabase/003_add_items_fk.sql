-- Add foreign key constraint for items.source_conversation -> conversations.id
BEGIN;

ALTER TABLE public.items
  ADD CONSTRAINT IF NOT EXISTS items_source_conversation_fkey
    FOREIGN KEY (source_conversation)
    REFERENCES public.conversations(id) ON DELETE SET NULL;

COMMIT;

-- This is safe to run idempotently: IF NOT EXISTS guards the constraint.

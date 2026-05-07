-- Chat messages table for AI memory
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_chat" ON chat_messages FOR ALL TO anon USING (true) WITH CHECK (true);

-- Optional: keep only last 200 messages to avoid unbounded growth
-- (Run this as a scheduled function in Supabase if needed)
-- DELETE FROM chat_messages WHERE id NOT IN (
--   SELECT id FROM chat_messages ORDER BY created_at DESC LIMIT 200
-- );

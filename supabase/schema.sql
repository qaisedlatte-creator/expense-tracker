-- Webbes Dashboard Schema
-- Run this entire file in the Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- ─── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'Pending'
                CHECK (status IN ('Pending', 'Confirmed', 'Paid')),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL
                CHECK (category IN ('Ads', 'Tools', 'Domain', 'Other')),
  platform    TEXT,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  type        TEXT NOT NULL
                CHECK (type IN ('One-Time', 'Monthly', 'Variable')),
  project_id  TEXT,           -- stores project name or 'General'
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_spend (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform    TEXT NOT NULL,
  week_start  DATE NOT NULL,
  budget      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  spent       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, week_start)
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ────────────────────────────────────────────────────────
-- Public access (no auth required) — both partners read/write via shared URL.
-- If you want to restrict later, enable auth and update these policies.

ALTER TABLE projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_spend   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings   ENABLE ROW LEVEL SECURITY;

-- Allow full public access (anon key users)
CREATE POLICY "public_all_projects"  ON projects  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_all_expenses"  ON expenses  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_all_ad_spend"  ON ad_spend  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_all_settings"  ON settings  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Enable Realtime ──────────────────────────────────────────────────────────
-- Go to Database > Replication in Supabase dashboard and enable replication
-- for: projects, expenses, ad_spend, settings
-- Or run:
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE ad_spend;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- ─── Default Settings ─────────────────────────────────────────────────────────

INSERT INTO settings (key, value) VALUES
  ('starting_capital',  '20000'),
  ('monthly_overhead',  '2000'),
  ('weekly_ad_budget',  '1500'),
  ('currency_symbol',   '₹'),
  ('business_name',     'Webbes')
ON CONFLICT (key) DO NOTHING;

-- ─── Seed Projects ────────────────────────────────────────────────────────────

INSERT INTO projects (name, amount, status, date) VALUES
  ('5k Project',  5000,  'Confirmed', '2026-04-23'),
  ('20k Project', 20000, 'Pending',   '2026-04-23')
ON CONFLICT DO NOTHING;

-- ─── Seed Expenses ────────────────────────────────────────────────────────────

INSERT INTO expenses (name, category, platform, amount, type, project_id, date, notes) VALUES
  ('Google Ads',          'Ads',    'Google',     500,  'Variable',  '5k Project', '2026-04-23', NULL),
  ('Meta Ads',            'Ads',    'Meta',        557,  'Variable',  '5k Project', '2026-04-23', NULL),
  ('Meta Ads',            'Ads',    'Meta',        662,  'Variable',  '5k Project', '2026-04-23', NULL),
  ('Webbes Domain',       'Domain', NULL,          117,  'One-Time',  'General',    '2026-04-23', NULL),
  ('Claude Subscription', 'Tools',  'Anthropic',  2000, 'Monthly',   'General',    '2026-04-23', 'March - logged late'),
  ('Claude Subscription', 'Tools',  'Anthropic',  2000, 'Monthly',   'General',    '2026-04-23', 'April')
ON CONFLICT DO NOTHING;

-- ─── Seed Ad Spend (current week starting Apr 21 2026) ───────────────────────

INSERT INTO ad_spend (platform, week_start, budget, spent) VALUES
  ('Meta Ads',   '2026-04-21', 1000, 1219),
  ('Google Ads', '2026-04-21',  500,  500)
ON CONFLICT (platform, week_start) DO NOTHING;

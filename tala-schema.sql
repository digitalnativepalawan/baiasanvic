-- TALA Agent Schema for Supabase
-- Paste this into Lovable Cloud → SQL Editor

-- ============================================================
-- 1. ROOMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tala_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning')),
  capacity INT DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed rooms
INSERT INTO tala_rooms (name, type, capacity) VALUES
  ('Sol Dorm', 'dorm', 4),
  ('Playa 1', 'standard', 2),
  ('Playa 2', 'standard', 2),
  ('Palma Suite', 'suite', 2),
  ('Garden Room', 'standard', 2),
  ('Rooftop Suite', 'suite', 2)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tala_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('cleaning', 'maintenance', 'restock', 'inspection', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  notes TEXT,
  assigned_to TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- 3. TALA CONVERSATION LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS tala_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('guest', 'agent')),
  content TEXT NOT NULL,
  brain TEXT DEFAULT 'tala',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tala_conversations_session ON tala_conversations(session_id);

-- ============================================================
-- 4. EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tala_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  max_guests INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed events
INSERT INTO tala_events (title, event_date, event_time, location) VALUES
  ('Sunset Yoga at Playa Guiones', CURRENT_DATE + 1, '17:00', 'Beach'),
  ('Community Ceviche Night', CURRENT_DATE + 2, '19:00', 'Common Area'),
  ('Island Hopping Tour', CURRENT_DATE + 3, '08:30', 'Dock')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. NOMAD LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tala_nomad_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  handle TEXT,
  source TEXT,
  interest TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'lost')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. TALA CONFIG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tala_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default config
INSERT INTO tala_config (key, value) VALUES
  ('general', '{"enabled": true, "provider": "ollama", "voice_enabled": true}'),
  ('concierge', '{"max_turns": 20, "fallback_email": "hello@baiapalawan.com"}')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- Rooms: public read, admin write
ALTER TABLE tala_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rooms public read" ON tala_rooms FOR SELECT USING (true);
CREATE POLICY "Rooms admin write" ON tala_rooms FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Tasks: public read, admin write
ALTER TABLE tala_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tasks public read" ON tala_tasks FOR SELECT USING (true);
CREATE POLICY "Tasks admin write" ON tala_tasks FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Conversations: admin only
ALTER TABLE tala_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conversations admin read" ON tala_conversations FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Conversations insert" ON tala_conversations FOR INSERT WITH CHECK (true);

-- Events: public read, admin write
ALTER TABLE tala_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events public read" ON tala_events FOR SELECT USING (true);
CREATE POLICY "Events admin write" ON tala_events FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Nomad leads: admin only
ALTER TABLE tala_nomad_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nomads admin only" ON tala_nomad_leads FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Config: admin only
ALTER TABLE tala_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config admin only" ON tala_config FOR ALL USING (has_role(auth.uid(), 'admin'));

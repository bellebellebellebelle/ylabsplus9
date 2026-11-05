CREATE TABLE public.tep_board_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',
  content TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'yellow',
  x DOUBLE PRECISION NOT NULL DEFAULT 100,
  y DOUBLE PRECISION NOT NULL DEFAULT 100,
  w DOUBLE PRECISION NOT NULL DEFAULT 220,
  h DOUBLE PRECISION NOT NULL DEFAULT 220,
  done BOOLEAN NOT NULL DEFAULT false,
  due_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  google_task_id TEXT,
  google_event_id TEXT,
  ai_result TEXT,
  mail_to text,
  mail_subject text,
  mail_sent_at timestamptz,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_board_items TO authenticated;
GRANT ALL ON public.tep_board_items TO service_role;
ALTER TABLE public.tep_board_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own board items" ON public.tep_board_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tep_user_settings (
  user_id UUID NOT NULL PRIMARY KEY,
  display_name TEXT,
  board_theme TEXT NOT NULL DEFAULT 'slate',
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  default_calendar_id TEXT NOT NULL DEFAULT 'primary',
  default_tasklist_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_user_settings TO authenticated;
GRANT ALL ON public.tep_user_settings TO service_role;
ALTER TABLE public.tep_user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own settings" ON public.tep_user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tep_google_connections (
  user_id UUID NOT NULL PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  google_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.tep_google_connections TO service_role;
ALTER TABLE public.tep_google_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tep_google_oauth_states (
  state TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.tep_google_oauth_states TO service_role;
ALTER TABLE public.tep_google_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tep_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER board_items_touch BEFORE UPDATE ON public.tep_board_items FOR EACH ROW EXECUTE FUNCTION public.tep_touch_updated_at();
CREATE TRIGGER user_settings_touch BEFORE UPDATE ON public.tep_user_settings FOR EACH ROW EXECUTE FUNCTION public.tep_touch_updated_at();
CREATE TRIGGER google_connections_touch BEFORE UPDATE ON public.tep_google_connections FOR EACH ROW EXECUTE FUNCTION public.tep_touch_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_board_items;

CREATE TABLE public.tep_boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nouveau problème',
  problem TEXT NOT NULL DEFAULT '',
  progress INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_boards TO authenticated;
GRANT ALL ON public.tep_boards TO service_role;
ALTER TABLE public.tep_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own boards" ON public.tep_boards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TABLE public.tep_bubbles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.tep_boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL DEFAULT '',
  mission TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idle',
  done BOOLEAN NOT NULL DEFAULT false,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tep_bubbles_board_idx ON public.tep_bubbles(board_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_bubbles TO authenticated;
GRANT ALL ON public.tep_bubbles TO service_role;
ALTER TABLE public.tep_bubbles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bubbles" ON public.tep_bubbles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER boards_touch BEFORE UPDATE ON public.tep_boards FOR EACH ROW EXECUTE FUNCTION public.tep_touch_updated_at();
CREATE TRIGGER bubbles_touch BEFORE UPDATE ON public.tep_bubbles FOR EACH ROW EXECUTE FUNCTION public.tep_touch_updated_at();
ALTER TABLE public.tep_boards REPLICA IDENTITY FULL;
ALTER TABLE public.tep_bubbles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_bubbles;

CREATE TABLE public.tep_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  w DOUBLE PRECISION NOT NULL DEFAULT 260,
  h DOUBLE PRECISION NOT NULL DEFAULT 180,
  color TEXT NOT NULL DEFAULT 'amber',
  parent_id UUID REFERENCES public.tep_cards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_cards TO authenticated;
GRANT ALL ON public.tep_cards TO service_role;
ALTER TABLE public.tep_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards" ON public.tep_cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tep_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  source_id UUID NOT NULL REFERENCES public.tep_cards(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.tep_cards(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, target_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_links TO authenticated;
GRANT ALL ON public.tep_links TO service_role;
ALTER TABLE public.tep_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own links" ON public.tep_links FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX tep_cards_user_idx ON public.tep_cards(user_id);
CREATE INDEX tep_links_user_idx ON public.tep_links(user_id);

CREATE OR REPLACE FUNCTION public.tep_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER cards_updated_at BEFORE UPDATE ON public.tep_cards FOR EACH ROW EXECUTE FUNCTION public.tep_set_updated_at();

ALTER TABLE public.tep_cards REPLICA IDENTITY FULL;
ALTER TABLE public.tep_links REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_links;

CREATE TABLE public.tep_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.tep_notes(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  w DOUBLE PRECISION NOT NULL DEFAULT 280,
  h DOUBLE PRECISION NOT NULL DEFAULT 200,
  color TEXT NOT NULL DEFAULT 'amber',
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX tep_notes_user_id_idx ON public.tep_notes(user_id);
CREATE INDEX tep_notes_parent_id_idx ON public.tep_notes(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_notes TO authenticated;
GRANT ALL ON public.tep_notes TO service_role;
ALTER TABLE public.tep_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own notes" ON public.tep_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.tep_update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.tep_notes FOR EACH ROW EXECUTE FUNCTION public.tep_update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_notes;

CREATE TABLE public.tep_stickies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  day DATE NOT NULL,
  kind TEXT NOT NULL DEFAULT 'task',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  start_time TEXT,
  duration_min INTEGER,
  color TEXT NOT NULL DEFAULT 'amber',
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT false,
  google_id text,
  google_list_id text,
  email_to text,
  email_sent boolean NOT NULL DEFAULT false,
  synced_at timestamptz,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_stickies TO authenticated;
GRANT ALL ON public.tep_stickies TO service_role;
ALTER TABLE public.tep_stickies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stickies" ON public.tep_stickies FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tep_stickies_user_day_idx ON public.tep_stickies (user_id, day);
CREATE INDEX tep_stickies_google_id_idx ON public.tep_stickies (user_id, google_id);
CREATE TRIGGER stickies_updated_at BEFORE UPDATE ON public.tep_stickies FOR EACH ROW EXECUTE FUNCTION public.tep_set_updated_at();

CREATE TABLE public.tep_planning_google_connections (
  user_id uuid PRIMARY KEY,
  google_email text,
  scopes text NOT NULL DEFAULT '',
  refresh_token_ciphertext text NOT NULL,
  access_token_ciphertext text,
  access_token_expires_at timestamptz,
  tasklist_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tep_planning_google_connections TO authenticated;
GRANT ALL ON public.tep_planning_google_connections TO service_role;
ALTER TABLE public.tep_planning_google_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own planning google connection" ON public.tep_planning_google_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER planning_google_connections_updated_at BEFORE UPDATE ON public.tep_planning_google_connections FOR EACH ROW EXECUTE FUNCTION public.tep_set_updated_at();

CREATE TABLE public.tep_planning_google_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  redirect_uri text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tep_planning_google_oauth_states TO service_role;
ALTER TABLE public.tep_planning_google_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tep_content_set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.tep_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Ma marque',
  description TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  pillars TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#7C5CFF',
  secondary_color TEXT NOT NULL DEFAULT '#00E0B8',
  font TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_brands TO authenticated;
GRANT ALL ON public.tep_brands TO service_role;
ALTER TABLE public.tep_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own brands" ON public.tep_brands FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER brands_updated BEFORE UPDATE ON public.tep_brands FOR EACH ROW EXECUTE FUNCTION public.tep_content_set_updated_at();

CREATE TABLE public.tep_content_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Mon tableau',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_content_boards TO authenticated;
GRANT ALL ON public.tep_content_boards TO service_role;
ALTER TABLE public.tep_content_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own content boards" ON public.tep_content_boards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER content_boards_updated BEFORE UPDATE ON public.tep_content_boards FOR EACH ROW EXECUTE FUNCTION public.tep_content_set_updated_at();

CREATE TABLE public.tep_content_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  board_id UUID NOT NULL REFERENCES public.tep_content_boards(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'idea',
  network TEXT,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  width DOUBLE PRECISION NOT NULL DEFAULT 280,
  height DOUBLE PRECISION NOT NULL DEFAULT 220,
  color TEXT NOT NULL DEFAULT 'violet',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'idea',
  scheduled_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tep_content_notes_board_idx ON public.tep_content_notes(board_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_content_notes TO authenticated;
GRANT ALL ON public.tep_content_notes TO service_role;
ALTER TABLE public.tep_content_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own content notes" ON public.tep_content_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER content_notes_updated BEFORE UPDATE ON public.tep_content_notes FOR EACH ROW EXECUTE FUNCTION public.tep_content_set_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_content_notes;

CREATE TABLE public.tep_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  department TEXT NOT NULL,
  name TEXT NOT NULL,
  mission TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_teams TO authenticated;
GRANT ALL ON public.tep_teams TO service_role;
ALTER TABLE public.tep_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own teams" ON public.tep_teams FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tep_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  team_id UUID REFERENCES public.tep_teams(id) ON DELETE SET NULL,
  department TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  is_chief BOOLEAN NOT NULL DEFAULT false,
  model TEXT NOT NULL DEFAULT 'openai/gpt-5.6-terra',
  system_prompt TEXT NOT NULL DEFAULT '',
  temperature NUMERIC NOT NULL DEFAULT 0.6,
  skills TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'amber',
  pos_x NUMERIC NOT NULL DEFAULT 0,
  pos_y NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_agents TO authenticated;
GRANT ALL ON public.tep_agents TO service_role;
ALTER TABLE public.tep_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agents" ON public.tep_agents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tep_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.tep_teams(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  summary TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_missions TO authenticated;
GRANT ALL ON public.tep_missions TO service_role;
ALTER TABLE public.tep_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own missions" ON public.tep_missions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tep_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.tep_teams(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES public.tep_missions(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.tep_agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  brief TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  result TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_tasks TO authenticated;
GRANT ALL ON public.tep_tasks TO service_role;
ALTER TABLE public.tep_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.tep_tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER tasks_touch BEFORE UPDATE ON public.tep_tasks
FOR EACH ROW EXECUTE FUNCTION public.tep_touch_updated_at();

CREATE INDEX ON public.tep_agents (user_id);
CREATE INDEX ON public.tep_tasks (team_id);
CREATE INDEX ON public.tep_missions (team_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_missions;

CREATE TABLE public.tep_odoo_connections (id uuid primary key default gen_random_uuid(), user_id uuid not null, url text not null, database text not null, username text not null, api_key text not null, uid integer, connected boolean not null default false, created_at timestamptz not null default now(), unique (user_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_odoo_connections TO authenticated;
GRANT ALL ON public.tep_odoo_connections TO service_role;
ALTER TABLE public.tep_odoo_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own odoo" ON public.tep_odoo_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tep_department_modules (id uuid primary key default gen_random_uuid(), user_id uuid not null, department text not null, modules text[] not null default '{}', created_at timestamptz not null default now(), unique (user_id, department));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_department_modules TO authenticated;
GRANT ALL ON public.tep_department_modules TO service_role;
ALTER TABLE public.tep_department_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dept modules" ON public.tep_department_modules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tep_custom_departments (id uuid primary key default gen_random_uuid(), user_id uuid not null, key text not null, label text not null, blurb text not null default '', default_team text not null default 'Nouvelle équipe', created_at timestamptz not null default now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_custom_departments TO authenticated;
GRANT ALL ON public.tep_custom_departments TO service_role;
ALTER TABLE public.tep_custom_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own custom depts" ON public.tep_custom_departments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tep_sketch_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nouveau tableau',
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_sketch_boards TO authenticated;
GRANT ALL ON public.tep_sketch_boards TO service_role;
ALTER TABLE public.tep_sketch_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sketch boards" ON public.tep_sketch_boards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tep_sketch_boards_user_updated_idx ON public.tep_sketch_boards (user_id, updated_at DESC);
CREATE TRIGGER sketch_boards_set_updated_at BEFORE UPDATE ON public.tep_sketch_boards FOR EACH ROW EXECUTE FUNCTION public.tep_set_updated_at();
ALTER TABLE public.tep_sketch_boards REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tep_sketch_boards;

CREATE TABLE public.tep_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  parent_board_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Sans titre',
  board_type text NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tep_projects_parent_idx ON public.tep_projects(parent_board_id);
CREATE INDEX tep_projects_user_idx ON public.tep_projects(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tep_projects TO authenticated;
GRANT ALL ON public.tep_projects TO service_role;
ALTER TABLE public.tep_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects select" ON public.tep_projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own projects insert" ON public.tep_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own projects update" ON public.tep_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own projects delete" ON public.tep_projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.tep_board_items ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
ALTER TABLE public.tep_cards ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
ALTER TABLE public.tep_links ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
ALTER TABLE public.tep_notes ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
ALTER TABLE public.tep_content_boards ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
ALTER TABLE public.tep_brands ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
ALTER TABLE public.tep_stickies ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
ALTER TABLE public.tep_teams ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
ALTER TABLE public.tep_agents ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
ALTER TABLE public.tep_custom_departments ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
ALTER TABLE public.tep_boards ADD COLUMN project_id uuid REFERENCES public.tep_projects(id) ON DELETE CASCADE;
CREATE INDEX tep_board_items_project_idx ON public.tep_board_items(project_id);
CREATE INDEX tep_cards_project_idx ON public.tep_cards(project_id);
CREATE INDEX tep_links_project_idx ON public.tep_links(project_id);
CREATE INDEX tep_notes_project_idx ON public.tep_notes(project_id);
CREATE INDEX tep_content_boards_project_idx ON public.tep_content_boards(project_id);
CREATE INDEX tep_brands_project_idx ON public.tep_brands(project_id);
CREATE INDEX tep_stickies_project_idx ON public.tep_stickies(project_id);
CREATE INDEX tep_teams_project_idx ON public.tep_teams(project_id);
CREATE INDEX tep_agents_project_idx ON public.tep_agents(project_id);
CREATE INDEX tep_custom_departments_project_idx ON public.tep_custom_departments(project_id);
CREATE INDEX tep_boards_project_idx ON public.tep_boards(project_id);
CREATE UNIQUE INDEX tep_custom_departments_user_project_key_idx ON public.tep_custom_departments (user_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), key);
COMMENT ON COLUMN public.tep_board_items.project_id IS 'Owning sub-board; NULL = default (standalone) board';
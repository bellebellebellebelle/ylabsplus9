CREATE TABLE public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT ALL ON public.folders TO service_role;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own folders" ON public.folders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  storage_path text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  favorite boolean NOT NULL DEFAULT false,
  encrypted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO authenticated;
GRANT ALL ON public.files TO service_role;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own files" ON public.files FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(18), 'hex'),
  permission text NOT NULL DEFAULT 'view',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shares TO authenticated;
GRANT ALL ON public.shares TO service_role;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own shares" ON public.shares FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  file_name text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activities" ON public.activities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.assistant_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  request text NOT NULL DEFAULT '',
  action_type text NOT NULL DEFAULT 'none',
  target text,
  value text,
  status text NOT NULL DEFAULT 'info',
  detail text NOT NULL DEFAULT '',
  reply text NOT NULL DEFAULT '',
  sources text[] NOT NULL DEFAULT '{}',
  app text NOT NULL DEFAULT 'sky',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.assistant_logs TO authenticated;
GRANT ALL ON public.assistant_logs TO service_role;
ALTER TABLE public.assistant_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs read" ON public.assistant_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own logs insert" ON public.assistant_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sky files select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "sky files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "sky files update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "sky files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER PUBLICATION supabase_realtime ADD TABLE public.files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assistant_logs;

CREATE OR REPLACE FUNCTION public.meets_mfa_requirement()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND (
   COALESCE(auth.jwt()->>'aal', '') = 'aal2' OR NOT EXISTS (
     SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified'
   )
 );
$$;
REVOKE ALL ON FUNCTION public.meets_mfa_requirement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meets_mfa_requirement() TO authenticated;
CREATE POLICY "require MFA files" ON public.files AS RESTRICTIVE FOR ALL TO authenticated USING (public.meets_mfa_requirement()) WITH CHECK (public.meets_mfa_requirement());
CREATE POLICY "require MFA folders" ON public.folders AS RESTRICTIVE FOR ALL TO authenticated USING (public.meets_mfa_requirement()) WITH CHECK (public.meets_mfa_requirement());
CREATE POLICY "require MFA shares" ON public.shares AS RESTRICTIVE FOR ALL TO authenticated USING (public.meets_mfa_requirement()) WITH CHECK (public.meets_mfa_requirement());
CREATE POLICY "require MFA activities" ON public.activities AS RESTRICTIVE FOR ALL TO authenticated USING (public.meets_mfa_requirement()) WITH CHECK (public.meets_mfa_requirement());
CREATE POLICY "require MFA assistant logs" ON public.assistant_logs AS RESTRICTIVE FOR ALL TO authenticated USING (public.meets_mfa_requirement()) WITH CHECK (public.meets_mfa_requirement());
CREATE POLICY "require MFA private storage" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING (bucket_id <> 'files' OR public.meets_mfa_requirement()) WITH CHECK (bucket_id <> 'files' OR public.meets_mfa_requirement());

CREATE OR REPLACE FUNCTION public.validate_file_security()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.storage_path IS DISTINCT FROM OLD.storage_path OR NEW.encrypted IS DISTINCT FROM OLD.encrypted) THEN
   RAISE EXCEPTION 'File owner, storage path and encryption state cannot be changed';
 END IF;
 IF split_part(NEW.storage_path, '/', 1) <> NEW.user_id::text THEN RAISE EXCEPTION 'Invalid storage owner'; END IF;
 IF TG_OP = 'INSERT' AND NOT NEW.encrypted THEN RAISE EXCEPTION 'New files must be encrypted in the browser'; END IF;
 IF NEW.folder_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.folders WHERE id = NEW.folder_id AND user_id = NEW.user_id) THEN RAISE EXCEPTION 'Folder access denied'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER validate_file_security BEFORE INSERT OR UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.validate_file_security();

CREATE OR REPLACE FUNCTION public.validate_share_security()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.permission NOT IN ('view', 'download') THEN RAISE EXCEPTION 'Invalid share permission'; END IF;
 IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.file_id IS DISTINCT FROM OLD.file_id OR NEW.token IS DISTINCT FROM OLD.token) THEN RAISE EXCEPTION 'Share identity cannot be changed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.files f WHERE f.id = NEW.file_id AND f.user_id = NEW.user_id AND f.deleted_at IS NULL AND NOT f.encrypted AND split_part(f.storage_path, '/', 1) = NEW.user_id::text) THEN RAISE EXCEPTION 'Sharing denied: foreign, deleted or encrypted file'; END IF;
 IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN RAISE EXCEPTION 'Share expiry must be in the future'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER validate_share_security BEFORE INSERT OR UPDATE ON public.shares FOR EACH ROW EXECUTE FUNCTION public.validate_share_security();

CREATE TABLE public.task_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT 'sage',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  list_id uuid REFERENCES public.task_lists(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sky_user_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  display_name text,
  accent text NOT NULL DEFAULT 'sage',
  daily_goal int NOT NULL DEFAULT 5,
  notifications boolean NOT NULL DEFAULT false,
  compact boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_lists, public.tasks, public.notes, public.sky_user_settings TO authenticated;
GRANT ALL ON public.task_lists, public.tasks, public.notes, public.sky_user_settings TO service_role;
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sky_user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lists" ON public.task_lists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tasks" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes" ON public.notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settings" ON public.sky_user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.task_lists REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks, public.notes, public.task_lists;

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  client text,
  location text,
  notes text,
  category text NOT NULL DEFAULT 'travail',
  status text NOT NULL DEFAULT 'prevu',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  buffer_min int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.appointments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX appointments_user_start ON public.appointments(user_id, start_at);

CREATE OR REPLACE FUNCTION public.check_appointment_conflict()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.end_at <= NEW.start_at THEN
    RAISE EXCEPTION 'La fin doit être après le début';
  END IF;
  IF NEW.status <> 'annule' AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.user_id = NEW.user_id AND a.id <> NEW.id AND a.status <> 'annule'
      AND a.start_at < NEW.end_at + make_interval(mins => NEW.buffer_min)
      AND NEW.start_at < a.end_at + make_interval(mins => a.buffer_min)
  ) THEN
    RAISE EXCEPTION 'CONFLIT: ce créneau chevauche un rendez-vous existant';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointments_conflict BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.check_appointment_conflict();

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

CREATE TABLE public.planner_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'postit',
  day date NOT NULL DEFAULT current_date,
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'sun',
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_notes TO authenticated;
GRANT ALL ON public.planner_notes TO service_role;
ALTER TABLE public.planner_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.planner_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.planner_notes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.planner_notes;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Sans titre',
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Brouillon',
  version int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs" ON public.documents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sky_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sky_messages TO authenticated;
GRANT ALL ON public.sky_messages TO service_role;
ALTER TABLE public.sky_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own msgs" ON public.sky_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sky_messages;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL DEFAULT 'Nouveau projet',
  data_text text,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_index integer NOT NULL DEFAULT -1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

CREATE TABLE public.mailboxes (
  user_id uuid PRIMARY KEY,
  local_part text NOT NULL UNIQUE CHECK (local_part ~ '^[a-z0-9]([a-z0-9._-]{0,30}[a-z0-9])?$'),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mailboxes TO authenticated;
GRANT ALL ON public.mailboxes TO service_role;
ALTER TABLE public.mailboxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mailbox select" ON public.mailboxes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own mailbox insert" ON public.mailboxes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own mailbox update" ON public.mailboxes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_address_available(_local text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.mailboxes WHERE local_part = lower(trim(_local)))
$$;
REVOKE ALL ON FUNCTION public.is_address_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_address_available(text) TO authenticated;

CREATE TABLE public.mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  folder text NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox','sent','drafts','spam','trash')),
  from_address text NOT NULL DEFAULT '',
  from_name text,
  to_addresses text NOT NULL DEFAULT '',
  cc_addresses text,
  subject text NOT NULL DEFAULT '',
  body_text text,
  body_html text,
  raw_mime text,
  provider_message_id text,
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  is_priority boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_messages_user_folder_idx ON public.mail_messages(user_id, folder, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_messages TO authenticated;
GRANT ALL ON public.mail_messages TO service_role;
ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mail select" ON public.mail_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own mail insert drafts" ON public.mail_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND folder = 'drafts');
CREATE POLICY "own mail update" ON public.mail_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own mail delete" ON public.mail_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.mail_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  filename text NOT NULL,
  content_type text,
  size_bytes bigint,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mail_attachments TO authenticated;
GRANT ALL ON public.mail_attachments TO service_role;
ALTER TABLE public.mail_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mail attachments select" ON public.mail_attachments FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own mail attachment files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mail-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER PUBLICATION supabase_realtime ADD TABLE public.mail_messages;
-- DeckVault collaboration: shared collections, invites, Realtime

-- Collection extras (if not already applied via Drizzle push)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Members & invites
CREATE TABLE IF NOT EXISTS collection_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, user_id)
);

CREATE TABLE IF NOT EXISTS collection_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, email)
);

CREATE INDEX IF NOT EXISTS idx_collection_members_user ON collection_members(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_members_collection ON collection_members(collection_id);

ALTER TABLE collection_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_invites ENABLE ROW LEVEL SECURITY;

-- Helper: user can access collection (owner or member)
CREATE OR REPLACE FUNCTION public.user_can_access_collection(cid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = cid AND c.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM collection_members m
    WHERE m.collection_id = cid AND m.user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_can_edit_collection(cid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = cid AND c.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM collection_members m
    WHERE m.collection_id = cid AND m.user_id = auth.uid() AND m.role IN ('owner', 'editor')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Accept pending invites for logged-in user email
CREATE OR REPLACE FUNCTION public.accept_collection_invites()
RETURNS void AS $$
DECLARE
  user_email text;
BEGIN
  user_email := lower(auth.jwt() ->> 'email');
  IF user_email IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO collection_members (collection_id, user_id, role)
  SELECT ci.collection_id, auth.uid(), ci.role
  FROM collection_invites ci
  WHERE lower(ci.email) = user_email
  ON CONFLICT (collection_id, user_id) DO NOTHING;

  DELETE FROM collection_invites ci
  WHERE lower(ci.email) = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old collection policies
DROP POLICY IF EXISTS "Users can view own collections" ON collections;
DROP POLICY IF EXISTS "Users can insert own collections" ON collections;
DROP POLICY IF EXISTS "Users can update own collections" ON collections;
DROP POLICY IF EXISTS "Users can delete own collections" ON collections;
DROP POLICY IF EXISTS "View accessible collections" ON collections;
DROP POLICY IF EXISTS "Insert own collections" ON collections;
DROP POLICY IF EXISTS "Update editable collections" ON collections;
DROP POLICY IF EXISTS "Delete own collections" ON collections;

CREATE POLICY "View accessible collections" ON collections FOR SELECT
  USING (public.user_can_access_collection(id));

CREATE POLICY "Insert own collections" ON collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update editable collections" ON collections FOR UPDATE
  USING (public.user_can_edit_collection(id));

CREATE POLICY "Delete own collections" ON collections FOR DELETE
  USING (auth.uid() = user_id);

-- Drop old owned_cards policies
DROP POLICY IF EXISTS "Users can view own owned cards" ON owned_cards;
DROP POLICY IF EXISTS "Users can insert own owned cards" ON owned_cards;
DROP POLICY IF EXISTS "Users can update own owned cards" ON owned_cards;
DROP POLICY IF EXISTS "Users can delete own owned cards" ON owned_cards;
DROP POLICY IF EXISTS "View accessible owned cards" ON owned_cards;
DROP POLICY IF EXISTS "Insert editable owned cards" ON owned_cards;
DROP POLICY IF EXISTS "Update editable owned cards" ON owned_cards;
DROP POLICY IF EXISTS "Delete editable owned cards" ON owned_cards;

CREATE POLICY "View accessible owned cards" ON owned_cards FOR SELECT
  USING (public.user_can_access_collection(collection_id));

CREATE POLICY "Insert editable owned cards" ON owned_cards FOR INSERT
  WITH CHECK (public.user_can_edit_collection(collection_id));

CREATE POLICY "Update editable owned cards" ON owned_cards FOR UPDATE
  USING (public.user_can_edit_collection(collection_id));

CREATE POLICY "Delete editable owned cards" ON owned_cards FOR DELETE
  USING (public.user_can_edit_collection(collection_id));

-- collection_members policies
DROP POLICY IF EXISTS "View members of accessible collections" ON collection_members;
DROP POLICY IF EXISTS "Owners manage members" ON collection_members;

CREATE POLICY "View members of accessible collections" ON collection_members FOR SELECT
  USING (public.user_can_access_collection(collection_id));

CREATE POLICY "Owners manage members" ON collection_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
  );

-- collection_invites policies
DROP POLICY IF EXISTS "Owners manage invites" ON collection_invites;
DROP POLICY IF EXISTS "Invitees view own invites" ON collection_invites;

CREATE POLICY "Owners manage invites" ON collection_invites FOR ALL
  USING (
    EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Invitees view own invites" ON collection_invites FOR SELECT
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- Realtime (run once; ignore if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE owned_cards;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE collections;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

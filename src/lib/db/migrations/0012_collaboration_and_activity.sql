-- Reintroduce collaboration (members + invites) and collection activity log.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Members & invites
-- ---------------------------------------------------------------------------

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
CREATE INDEX IF NOT EXISTS idx_collection_invites_email ON collection_invites(email);

ALTER TABLE collection_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_invites ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS collection_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  actor_display_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  owned_card_id uuid,
  card_name text,
  before_state jsonb,
  after_state jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid
);

CREATE INDEX IF NOT EXISTS idx_collection_activity_collection_created
  ON collection_activity(collection_id, created_at DESC);

ALTER TABLE collection_activity ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS helpers (ensure members tables are consulted)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.user_can_access_collection(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = cid AND c.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM collection_members m
    WHERE m.collection_id = cid AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.user_can_edit_collection(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = cid AND c.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM collection_members m
    WHERE m.collection_id = cid AND m.user_id = auth.uid() AND m.role IN ('owner', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION private.user_owns_collection(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = cid AND c.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION private.user_can_access_collection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_can_edit_collection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_owns_collection(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.user_can_access_collection(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_can_edit_collection(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_owns_collection(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Accept pending invites for logged-in user email
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_collection_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  accepted integer := 0;
BEGIN
  user_email := lower(auth.jwt() ->> 'email');
  IF user_email IS NULL OR auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  WITH moved AS (
    INSERT INTO collection_members (collection_id, user_id, role)
    SELECT ci.collection_id, auth.uid(), ci.role
    FROM collection_invites ci
    WHERE lower(ci.email) = user_email
    ON CONFLICT (collection_id, user_id) DO NOTHING
    RETURNING collection_id
  )
  SELECT count(*) INTO accepted FROM moved;

  DELETE FROM collection_invites ci
  WHERE lower(ci.email) = user_email;

  RETURN accepted;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_collection_invites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_collection_invites() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Collection policies (reaffirm helpers)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "View accessible collections" ON collections;
CREATE POLICY "View accessible collections" ON collections FOR SELECT
  USING (private.user_can_access_collection(id));

DROP POLICY IF EXISTS "Insert own collections" ON collections;
CREATE POLICY "Insert own collections" ON collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update editable collections" ON collections;
CREATE POLICY "Update editable collections" ON collections FOR UPDATE
  USING (private.user_can_edit_collection(id));

DROP POLICY IF EXISTS "Delete own collections" ON collections;
CREATE POLICY "Delete own collections" ON collections FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "View accessible owned cards" ON owned_cards;
CREATE POLICY "View accessible owned cards" ON owned_cards FOR SELECT
  USING (private.user_can_access_collection(collection_id));

DROP POLICY IF EXISTS "Insert editable owned cards" ON owned_cards;
CREATE POLICY "Insert editable owned cards" ON owned_cards FOR INSERT
  WITH CHECK (private.user_can_edit_collection(collection_id));

DROP POLICY IF EXISTS "Update editable owned cards" ON owned_cards;
CREATE POLICY "Update editable owned cards" ON owned_cards FOR UPDATE
  USING (private.user_can_edit_collection(collection_id));

DROP POLICY IF EXISTS "Delete editable owned cards" ON owned_cards;
CREATE POLICY "Delete editable owned cards" ON owned_cards FOR DELETE
  USING (private.user_can_edit_collection(collection_id));

-- ---------------------------------------------------------------------------
-- Members / invites policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "View members of accessible collections" ON collection_members;
CREATE POLICY "View members of accessible collections" ON collection_members FOR SELECT
  USING (private.user_can_access_collection(collection_id));

DROP POLICY IF EXISTS "Owners manage members" ON collection_members;
CREATE POLICY "Owners manage members" ON collection_members FOR ALL
  USING (private.user_owns_collection(collection_id))
  WITH CHECK (private.user_owns_collection(collection_id));

DROP POLICY IF EXISTS "Owners manage invites" ON collection_invites;
CREATE POLICY "Owners manage invites" ON collection_invites FOR ALL
  USING (private.user_owns_collection(collection_id))
  WITH CHECK (private.user_owns_collection(collection_id));

DROP POLICY IF EXISTS "Invitees view own invites" ON collection_invites;
CREATE POLICY "Invitees view own invites" ON collection_invites FOR SELECT
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- ---------------------------------------------------------------------------
-- Activity policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "View accessible activity" ON collection_activity;
CREATE POLICY "View accessible activity" ON collection_activity FOR SELECT
  USING (private.user_can_access_collection(collection_id));

DROP POLICY IF EXISTS "Editors insert activity" ON collection_activity;
CREATE POLICY "Editors insert activity" ON collection_activity FOR INSERT
  WITH CHECK (
    private.user_can_edit_collection(collection_id)
    AND actor_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Editors update activity undo" ON collection_activity;
CREATE POLICY "Editors update activity undo" ON collection_activity FOR UPDATE
  USING (private.user_can_edit_collection(collection_id));

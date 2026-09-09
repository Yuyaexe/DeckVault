-- Anime collection cloud workspace (shareable JSON snapshot)

CREATE TABLE IF NOT EXISTS anime_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anime_workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES anime_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS anime_workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES anime_workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

CREATE TABLE IF NOT EXISTS anime_workspace_snapshots (
  workspace_id uuid PRIMARY KEY REFERENCES anime_workspaces(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_anime_workspace_members_user ON anime_workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_anime_workspace_invites_email ON anime_workspace_invites(email);

ALTER TABLE anime_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE anime_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE anime_workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE anime_workspace_snapshots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.user_can_access_anime_workspace(wid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM anime_workspaces w
    WHERE w.id = wid AND w.owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM anime_workspace_members m
    WHERE m.workspace_id = wid AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.user_can_edit_anime_workspace(wid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM anime_workspaces w
    WHERE w.id = wid AND w.owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM anime_workspace_members m
    WHERE m.workspace_id = wid AND m.user_id = auth.uid() AND m.role IN ('owner', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION private.user_owns_anime_workspace(wid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM anime_workspaces w
    WHERE w.id = wid AND w.owner_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION private.user_can_access_anime_workspace(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_can_edit_anime_workspace(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_owns_anime_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.user_can_access_anime_workspace(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_can_edit_anime_workspace(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_owns_anime_workspace(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "View own or member anime workspaces" ON anime_workspaces;
CREATE POLICY "View own or member anime workspaces" ON anime_workspaces FOR SELECT
  USING (private.user_can_access_anime_workspace(id));

DROP POLICY IF EXISTS "Insert own anime workspace" ON anime_workspaces;
CREATE POLICY "Insert own anime workspace" ON anime_workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Update own anime workspace" ON anime_workspaces;
CREATE POLICY "Update own anime workspace" ON anime_workspaces FOR UPDATE
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "View anime workspace members" ON anime_workspace_members;
CREATE POLICY "View anime workspace members" ON anime_workspace_members FOR SELECT
  USING (private.user_can_access_anime_workspace(workspace_id));

DROP POLICY IF EXISTS "Owners manage anime members" ON anime_workspace_members;
CREATE POLICY "Owners manage anime members" ON anime_workspace_members FOR ALL
  USING (private.user_owns_anime_workspace(workspace_id))
  WITH CHECK (private.user_owns_anime_workspace(workspace_id));

DROP POLICY IF EXISTS "Owners manage anime invites" ON anime_workspace_invites;
CREATE POLICY "Owners manage anime invites" ON anime_workspace_invites FOR ALL
  USING (private.user_owns_anime_workspace(workspace_id))
  WITH CHECK (private.user_owns_anime_workspace(workspace_id));

DROP POLICY IF EXISTS "Invitees view anime invites" ON anime_workspace_invites;
CREATE POLICY "Invitees view anime invites" ON anime_workspace_invites FOR SELECT
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "View anime snapshots" ON anime_workspace_snapshots;
CREATE POLICY "View anime snapshots" ON anime_workspace_snapshots FOR SELECT
  USING (private.user_can_access_anime_workspace(workspace_id));

DROP POLICY IF EXISTS "Edit anime snapshots" ON anime_workspace_snapshots;
CREATE POLICY "Edit anime snapshots" ON anime_workspace_snapshots FOR ALL
  USING (private.user_can_edit_anime_workspace(workspace_id))
  WITH CHECK (private.user_can_edit_anime_workspace(workspace_id));

CREATE OR REPLACE FUNCTION public.accept_anime_workspace_invites()
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
    INSERT INTO anime_workspace_members (workspace_id, user_id, role)
    SELECT i.workspace_id, auth.uid(), i.role
    FROM anime_workspace_invites i
    WHERE lower(i.email) = user_email
    ON CONFLICT (workspace_id, user_id) DO NOTHING
    RETURNING workspace_id
  )
  SELECT count(*) INTO accepted FROM moved;

  DELETE FROM anime_workspace_invites i
  WHERE lower(i.email) = user_email;

  RETURN accepted;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_anime_workspace_invites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_anime_workspace_invites() TO authenticated, service_role;

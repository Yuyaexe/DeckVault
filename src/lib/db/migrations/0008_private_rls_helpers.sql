-- Move RLS helpers off the public API surface; revoke user-callable SECURITY DEFINER RPCs

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated;

-- ---------------------------------------------------------------------------
-- RLS helpers (private schema — not exposed as PostgREST RPC)
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

REVOKE ALL ON FUNCTION private.user_can_access_collection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_can_edit_collection(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.user_can_access_collection(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_can_edit_collection(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Recreate policies to use private helpers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "View accessible collections" ON collections;
CREATE POLICY "View accessible collections" ON collections FOR SELECT
  USING (private.user_can_access_collection(id));

DROP POLICY IF EXISTS "Update editable collections" ON collections;
CREATE POLICY "Update editable collections" ON collections FOR UPDATE
  USING (private.user_can_edit_collection(id));

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

DROP POLICY IF EXISTS "View members of accessible collections" ON collection_members;
CREATE POLICY "View members of accessible collections" ON collection_members FOR SELECT
  USING (private.user_can_access_collection(collection_id));

DROP POLICY IF EXISTS "View accessible folders" ON folders;
CREATE POLICY "View accessible folders" ON folders FOR SELECT
  USING (private.user_can_access_collection(collection_id));

DROP POLICY IF EXISTS "Insert editable folders" ON folders;
CREATE POLICY "Insert editable folders" ON folders FOR INSERT
  WITH CHECK (private.user_can_edit_collection(collection_id));

DROP POLICY IF EXISTS "Update editable folders" ON folders;
CREATE POLICY "Update editable folders" ON folders FOR UPDATE
  USING (private.user_can_edit_collection(collection_id));

DROP POLICY IF EXISTS "Delete editable folders" ON folders;
CREATE POLICY "Delete editable folders" ON folders FOR DELETE
  USING (private.user_can_edit_collection(collection_id));

DROP POLICY IF EXISTS "View own owned card tags" ON owned_card_tags;
CREATE POLICY "View own owned card tags" ON owned_card_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM owned_cards oc
      JOIN tags t ON t.id = tag_id
      WHERE oc.id = owned_card_id
        AND private.user_can_access_collection(oc.collection_id)
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Insert own owned card tags" ON owned_card_tags;
CREATE POLICY "Insert own owned card tags" ON owned_card_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM owned_cards oc
      JOIN tags t ON t.id = tag_id
      WHERE oc.id = owned_card_id
        AND private.user_can_edit_collection(oc.collection_id)
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Delete own owned card tags" ON owned_card_tags;
CREATE POLICY "Delete own owned card tags" ON owned_card_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM owned_cards oc
      JOIN tags t ON t.id = tag_id
      WHERE oc.id = owned_card_id
        AND private.user_can_edit_collection(oc.collection_id)
        AND t.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Drop public RPCs / helpers (server uses service role + direct RLS instead)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.user_can_access_collection(uuid);
DROP FUNCTION IF EXISTS public.user_can_edit_collection(uuid);
DROP FUNCTION IF EXISTS public.accept_collection_invites();
DROP FUNCTION IF EXISTS public.create_collection(text);

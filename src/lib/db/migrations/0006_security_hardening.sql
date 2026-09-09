-- Supabase Security Advisor: search_path, SECURITY DEFINER grants, pg_trgm schema

-- ---------------------------------------------------------------------------
-- 1. Fix mutable search_path on SECURITY DEFINER functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.collections (user_id, name, is_default)
  VALUES (NEW.id, 'My Collection', true);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_collection(cid uuid)
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

CREATE OR REPLACE FUNCTION public.user_can_edit_collection(cid uuid)
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

CREATE OR REPLACE FUNCTION public.accept_collection_invites()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- create_collection already has SET search_path in 0004; re-apply for idempotency
CREATE OR REPLACE FUNCTION public.create_collection(p_name text)
RETURNS collections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_row collections;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Collection name is required';
  END IF;

  INSERT INTO collections (user_id, name, is_default)
  VALUES (uid, trim(p_name), false)
  RETURNING * INTO new_row;

  RETURN new_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Revoke public/anon EXECUTE (RLS helpers + trigger are not RPCs)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE ALL ON FUNCTION public.user_can_access_collection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_access_collection(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_collection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_collection(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.user_can_edit_collection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_edit_collection(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_can_edit_collection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_edit_collection(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.accept_collection_invites() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_collection_invites() FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_collection_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_collection_invites() TO service_role;

REVOKE ALL ON FUNCTION public.create_collection(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_collection(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_collection(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_collection(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Move pg_trgm out of public schema (Supabase best practice)
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

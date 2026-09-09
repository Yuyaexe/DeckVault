-- Harden anime invite accept: fall back to auth.users.email when JWT email is missing

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
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  user_email := lower(coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
  ));

  IF user_email IS NULL THEN
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

-- Refresh PostgREST so /rest/v1 and RPC see the new objects immediately
NOTIFY pgrst, 'reload schema';

-- Safe collection creation: uses auth.uid() inside SECURITY DEFINER (fixes RLS insert on SSR/API routes)

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

GRANT EXECUTE ON FUNCTION public.create_collection(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_collection(text) TO service_role;

-- Editors may update collection details but must never transfer ownership.
CREATE OR REPLACE FUNCTION public.prevent_collection_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'collection owner cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collection_owner_immutable ON public.collections;
CREATE TRIGGER collection_owner_immutable
BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.prevent_collection_owner_change();

REVOKE ALL ON FUNCTION public.prevent_collection_owner_change() FROM PUBLIC;

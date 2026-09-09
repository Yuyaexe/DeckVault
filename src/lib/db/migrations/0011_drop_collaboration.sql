-- Remove collaboration tables (Share / invites / members). Product no longer supports collab.

DROP TABLE IF EXISTS public.collection_invites CASCADE;
DROP TABLE IF EXISTS public.collection_members CASCADE;

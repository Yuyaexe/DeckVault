-- Catalog cards table: read-only for authenticated clients.
-- Server-side catalog upserts use service role (see supabase-service.ts).

DROP POLICY IF EXISTS "Authenticated can update cards" ON cards;
DROP POLICY IF EXISTS "Authenticated can insert cards" ON cards;

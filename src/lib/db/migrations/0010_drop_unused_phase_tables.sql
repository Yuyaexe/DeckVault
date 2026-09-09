-- Drop unused Phase 2–4 product tables (no UI; removed from product scope).
-- Backup/restore by JSON file is unchanged. Collaboration (members/invites) is kept.

DROP TABLE IF EXISTS public.owned_card_tags CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.folders CASCADE;
DROP TABLE IF EXISTS public.wishlists CASCADE;
DROP TABLE IF EXISTS public.deck_cards CASCADE;
DROP TABLE IF EXISTS public.decks CASCADE;
DROP TABLE IF EXISTS public.price_history CASCADE;
DROP TABLE IF EXISTS public.marketplace_listings CASCADE;
DROP TABLE IF EXISTS public.trades CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Remove unused game seeds (app supports yugioh, pokemon, digimon only)
DELETE FROM public.games
WHERE slug IN ('magic', 'onepiece', 'lorcana');

-- Ensure owned_cards is in realtime publication (Live collab). Safe if already added.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'owned_cards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.owned_cards;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- Local/non-Supabase installs may not have supabase_realtime
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_collections_user ON public.collections (user_id);

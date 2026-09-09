-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Games seed
INSERT INTO games (id, slug, name) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'yugioh', 'Yu-Gi-Oh!'),
  ('a0000000-0000-4000-8000-000000000002', 'pokemon', 'Pokemon'),
  ('a0000000-0000-4000-8000-000000000003', 'digimon', 'Digimon')
ON CONFLICT (slug) DO NOTHING;

-- Trigram index for card name search
CREATE INDEX IF NOT EXISTS idx_cards_name_trgm ON cards USING gin (name gin_trgm_ops);

-- Signup trigger: create profile + default collection
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.collections (user_id, name, is_default)
  VALUES (NEW.id, 'My Collection', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

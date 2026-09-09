-- RLS for Phase 3 tables flagged by Supabase Security Advisor

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Shared market / price data (same pattern as cards)
CREATE POLICY "Price history is public read" ON price_history FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert price history" ON price_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update price history" ON price_history FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Marketplace listings are public read" ON marketplace_listings FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert marketplace listings" ON marketplace_listings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update marketplace listings" ON marketplace_listings FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Trades are private to initiator and recipient
CREATE POLICY "Users can view own trades" ON trades FOR SELECT
  USING (auth.uid() = initiator_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can create trades as initiator" ON trades FOR INSERT
  WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Participants can update trades" ON trades FOR UPDATE
  USING (auth.uid() = initiator_id OR auth.uid() = recipient_id);

CREATE POLICY "Initiator can delete pending trades" ON trades FOR DELETE
  USING (auth.uid() = initiator_id AND status = 'pending');

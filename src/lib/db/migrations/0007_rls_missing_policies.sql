-- RLS policies for tables that had RLS enabled (0002) but no policies defined

-- Folders (scoped to collection access / collaboration)
CREATE POLICY "View accessible folders" ON folders FOR SELECT
  USING (public.user_can_access_collection(collection_id));

CREATE POLICY "Insert editable folders" ON folders FOR INSERT
  WITH CHECK (public.user_can_edit_collection(collection_id));

CREATE POLICY "Update editable folders" ON folders FOR UPDATE
  USING (public.user_can_edit_collection(collection_id));

CREATE POLICY "Delete editable folders" ON folders FOR DELETE
  USING (public.user_can_edit_collection(collection_id));

-- Decks (user-owned)
CREATE POLICY "Users can manage own decks" ON decks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Deck cards (via deck ownership)
CREATE POLICY "View own deck cards" ON deck_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM decks d
      WHERE d.id = deck_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Insert own deck cards" ON deck_cards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decks d
      WHERE d.id = deck_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Update own deck cards" ON deck_cards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM decks d
      WHERE d.id = deck_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Delete own deck cards" ON deck_cards FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM decks d
      WHERE d.id = deck_id AND d.user_id = auth.uid()
    )
  );

-- Owned card tags (tag + owned card must belong to accessible collection)
CREATE POLICY "View own owned card tags" ON owned_card_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM owned_cards oc
      JOIN tags t ON t.id = tag_id
      WHERE oc.id = owned_card_id
        AND public.user_can_access_collection(oc.collection_id)
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Insert own owned card tags" ON owned_card_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM owned_cards oc
      JOIN tags t ON t.id = tag_id
      WHERE oc.id = owned_card_id
        AND public.user_can_edit_collection(oc.collection_id)
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Delete own owned card tags" ON owned_card_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM owned_cards oc
      JOIN tags t ON t.id = tag_id
      WHERE oc.id = owned_card_id
        AND public.user_can_edit_collection(oc.collection_id)
        AND t.user_id = auth.uid()
    )
  );

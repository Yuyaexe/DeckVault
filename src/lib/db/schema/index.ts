import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id),
    externalId: text("external_id"),
    name: text("name").notNull(),
    setCode: text("set_code"),
    setName: text("set_name"),
    collectorNumber: text("collector_number"),
    rarity: text("rarity"),
    imageUrl: text("image_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_cards_game_name").on(table.gameId, table.name),
    uniqueIndex("idx_cards_game_external").on(table.gameId, table.externalId),
  ]
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  defaultGameId: uuid("default_game_id").references(() => games.id),
  currency: text("currency").notNull().default("USD"),
  theme: text("theme").notNull().default("dark"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    isFavorite: boolean("is_favorite").notNull().default(false),
    coverImageUrl: text("cover_image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_collections_user").on(table.userId)]
);

export const ownedCards = pgTable(
  "owned_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id),
    quantity: integer("quantity").notNull().default(1),
    condition: text("condition").notNull().default("NM"),
    language: text("language").notNull().default("EN"),
    isFoil: boolean("is_foil").notNull().default(false),
    purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_owned_cards_collection").on(table.collectionId),
    index("idx_owned_cards_card").on(table.cardId),
  ]
);

export const gamesRelations = relations(games, ({ many }) => ({
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  game: one(games, { fields: [cards.gameId], references: [games.id] }),
  ownedCards: many(ownedCards),
}));

export const collectionMembers = pgTable(
  "collection_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("editor"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_collection_members_user").on(table.userId),
    index("idx_collection_members_collection").on(table.collectionId),
    uniqueIndex("collection_members_collection_id_user_id_unique").on(
      table.collectionId,
      table.userId
    ),
  ]
);

export const collectionInvites = pgTable(
  "collection_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("editor"),
    invitedBy: uuid("invited_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_collection_invites_email").on(table.email),
    uniqueIndex("collection_invites_collection_id_email_unique").on(
      table.collectionId,
      table.email
    ),
  ]
);

export const collectionActivity = pgTable(
  "collection_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").notNull(),
    actorDisplayName: text("actor_display_name").notNull().default(""),
    action: text("action").notNull(),
    ownedCardId: uuid("owned_card_id"),
    cardName: text("card_name"),
    beforeState: jsonb("before_state").$type<Record<string, unknown> | null>(),
    afterState: jsonb("after_state").$type<Record<string, unknown> | null>(),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    undoneAt: timestamp("undone_at"),
    undoneBy: uuid("undone_by"),
  },
  (table) => [
    index("idx_collection_activity_collection_created").on(
      table.collectionId,
      table.createdAt
    ),
  ]
);

export const collectionsRelations = relations(collections, ({ many }) => ({
  ownedCards: many(ownedCards),
  members: many(collectionMembers),
  invites: many(collectionInvites),
  activity: many(collectionActivity),
}));

export const ownedCardsRelations = relations(ownedCards, ({ one }) => ({
  collection: one(collections, { fields: [ownedCards.collectionId], references: [collections.id] }),
  card: one(cards, { fields: [ownedCards.cardId], references: [cards.id] }),
}));

export const collectionMembersRelations = relations(collectionMembers, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionMembers.collectionId],
    references: [collections.id],
  }),
}));

export const collectionInvitesRelations = relations(collectionInvites, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionInvites.collectionId],
    references: [collections.id],
  }),
}));

export const collectionActivityRelations = relations(collectionActivity, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionActivity.collectionId],
    references: [collections.id],
  }),
}));

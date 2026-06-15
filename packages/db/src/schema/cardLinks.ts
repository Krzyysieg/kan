import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { cards } from "./cards";
import { users } from "./users";

// Directed link types, stored from the source card's perspective.
// The inverse label (e.g. "blocked by") is derived when viewing the target card.
export const cardLinkTypes = ["blocks", "relates_to", "duplicates"] as const;
export type CardLinkType = (typeof cardLinkTypes)[number];
export const cardLinkTypeEnum = pgEnum("card_link_type", cardLinkTypes);

export const cardLinks = pgTable(
  "card_link",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),
    sourceCardId: bigint("sourceCardId", { mode: "number" })
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    targetCardId: bigint("targetCardId", { mode: "number" })
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    type: cardLinkTypeEnum("type").notNull(),
    createdBy: uuid("createdBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("card_link_unique_idx").on(
      table.sourceCardId,
      table.targetCardId,
      table.type,
    ),
    index("card_link_source_idx").on(table.sourceCardId),
    index("card_link_target_idx").on(table.targetCardId),
  ],
).enableRLS();

export const cardLinksRelations = relations(cardLinks, ({ one }) => ({
  sourceCard: one(cards, {
    fields: [cardLinks.sourceCardId],
    references: [cards.id],
    relationName: "cardLinkSource",
  }),
  targetCard: one(cards, {
    fields: [cardLinks.targetCardId],
    references: [cards.id],
    relationName: "cardLinkTarget",
  }),
  createdBy: one(users, {
    fields: [cardLinks.createdBy],
    references: [users.id],
    relationName: "cardLinksCreatedByUser",
  }),
}));

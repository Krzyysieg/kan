import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { cards } from "./cards";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const cardTypes = pgTable(
  "card_type",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    colourCode: varchar("colourCode", { length: 12 }),
    icon: varchar("icon", { length: 50 }),
    workspaceId: bigint("workspaceId", { mode: "number" })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("createdBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
    deletedAt: timestamp("deletedAt"),
    deletedBy: uuid("deletedBy").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("card_type_workspace_idx").on(table.workspaceId)],
).enableRLS();

export const cardTypesRelations = relations(cardTypes, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [cardTypes.workspaceId],
    references: [workspaces.id],
    relationName: "cardTypesWorkspace",
  }),
  createdBy: one(users, {
    fields: [cardTypes.createdBy],
    references: [users.id],
    relationName: "cardTypesCreatedByUser",
  }),
  deletedBy: one(users, {
    fields: [cardTypes.deletedBy],
    references: [users.id],
    relationName: "cardTypesDeletedByUser",
  }),
  cards: many(cards),
}));

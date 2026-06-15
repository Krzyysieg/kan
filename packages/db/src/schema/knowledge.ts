import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";
import { workspaces } from "./workspaces";

export const kbCategories = pgTable(
  "kb_category",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    index: integer("index").notNull().default(0),
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
  (table) => [index("kb_category_workspace_idx").on(table.workspaceId)],
).enableRLS();

export const kbArticles = pgTable(
  "kb_article",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull().default(""),
    index: integer("index").notNull().default(0),
    // Workspace is the real scope; category is optional so articles survive
    // category deletion (they drop to "Uncategorized").
    workspaceId: bigint("workspaceId", { mode: "number" })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    categoryId: bigint("categoryId", { mode: "number" }).references(
      (): AnyPgColumn => kbCategories.id,
      { onDelete: "set null" },
    ),
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
  (table) => [
    index("kb_article_workspace_idx").on(table.workspaceId),
    index("kb_article_category_idx").on(table.categoryId),
  ],
).enableRLS();

export const kbCategoriesRelations = relations(
  kbCategories,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [kbCategories.workspaceId],
      references: [workspaces.id],
      relationName: "kbCategoryWorkspace",
    }),
    createdBy: one(users, {
      fields: [kbCategories.createdBy],
      references: [users.id],
      relationName: "kbCategoryCreatedByUser",
    }),
    articles: many(kbArticles),
  }),
);

export const kbArticlesRelations = relations(kbArticles, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [kbArticles.workspaceId],
    references: [workspaces.id],
    relationName: "kbArticleWorkspace",
  }),
  category: one(kbCategories, {
    fields: [kbArticles.categoryId],
    references: [kbCategories.id],
    relationName: "kbArticleCategory",
  }),
  createdBy: one(users, {
    fields: [kbArticles.createdBy],
    references: [users.id],
    relationName: "kbArticleCreatedByUser",
  }),
}));

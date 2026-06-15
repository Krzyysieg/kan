import { and, asc, eq, isNull } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { kbArticles, kbCategories } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

/* ─── Categories ─────────────────────────────────────────────── */

export const getCategoriesByWorkspaceId = (
  db: dbClient,
  workspaceId: number,
) => {
  return db.query.kbCategories.findMany({
    columns: { publicId: true, name: true, index: true },
    where: and(
      eq(kbCategories.workspaceId, workspaceId),
      isNull(kbCategories.deletedAt),
    ),
    orderBy: [asc(kbCategories.index), asc(kbCategories.name)],
  });
};

export const createCategory = async (
  db: dbClient,
  input: { name: string; workspaceId: number; createdBy: string },
) => {
  const [result] = await db
    .insert(kbCategories)
    .values({
      publicId: generateUID(),
      name: input.name,
      workspaceId: input.workspaceId,
      createdBy: input.createdBy,
    })
    .returning({
      id: kbCategories.id,
      publicId: kbCategories.publicId,
      name: kbCategories.name,
    });

  return result;
};

export const getWorkspaceAndCategoryIdByPublicId = async (
  db: dbClient,
  categoryPublicId: string,
) => {
  const result = await db.query.kbCategories.findFirst({
    columns: { id: true, workspaceId: true },
    where: eq(kbCategories.publicId, categoryPublicId),
  });

  return result ? { id: result.id, workspaceId: result.workspaceId } : null;
};

export const updateCategory = async (
  db: dbClient,
  input: { categoryPublicId: string; name: string },
) => {
  const [result] = await db
    .update(kbCategories)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(kbCategories.publicId, input.categoryPublicId))
    .returning({
      id: kbCategories.id,
      publicId: kbCategories.publicId,
      name: kbCategories.name,
    });

  return result;
};

export const softDeleteCategory = async (
  db: dbClient,
  args: { categoryId: number; deletedAt: Date; deletedBy: string },
) => {
  const [result] = await db
    .update(kbCategories)
    .set({ deletedAt: args.deletedAt, deletedBy: args.deletedBy })
    .where(
      and(eq(kbCategories.id, args.categoryId), isNull(kbCategories.deletedAt)),
    )
    .returning({ id: kbCategories.id });

  return result;
};

// Soft delete keeps the row, so clear references from articles (they become
// uncategorized) rather than leaving them pointed at a hidden category.
export const clearCategoryFromArticles = async (
  db: dbClient,
  categoryId: number,
) => {
  await db
    .update(kbArticles)
    .set({ categoryId: null })
    .where(eq(kbArticles.categoryId, categoryId));
};

/* ─── Articles ───────────────────────────────────────────────── */

export const getArticlesByWorkspaceId = (
  db: dbClient,
  workspaceId: number,
) => {
  return db.query.kbArticles.findMany({
    columns: {
      publicId: true,
      title: true,
      index: true,
    },
    where: and(
      eq(kbArticles.workspaceId, workspaceId),
      isNull(kbArticles.deletedAt),
    ),
    orderBy: [asc(kbArticles.index), asc(kbArticles.title)],
    with: {
      category: {
        columns: { publicId: true, name: true },
      },
    },
  });
};

export const getArticleByPublicId = (db: dbClient, articlePublicId: string) => {
  return db.query.kbArticles.findFirst({
    columns: {
      publicId: true,
      title: true,
      content: true,
    },
    where: and(
      eq(kbArticles.publicId, articlePublicId),
      isNull(kbArticles.deletedAt),
    ),
    with: {
      category: {
        columns: { publicId: true, name: true },
      },
    },
  });
};

export const getWorkspaceAndArticleIdByPublicId = async (
  db: dbClient,
  articlePublicId: string,
) => {
  const result = await db.query.kbArticles.findFirst({
    columns: { id: true, workspaceId: true },
    where: eq(kbArticles.publicId, articlePublicId),
  });

  return result ? { id: result.id, workspaceId: result.workspaceId } : null;
};

export const createArticle = async (
  db: dbClient,
  input: {
    title: string;
    content: string;
    workspaceId: number;
    categoryId: number | null;
    createdBy: string;
  },
) => {
  const [result] = await db
    .insert(kbArticles)
    .values({
      publicId: generateUID(),
      title: input.title,
      content: input.content,
      workspaceId: input.workspaceId,
      categoryId: input.categoryId,
      createdBy: input.createdBy,
    })
    .returning({
      id: kbArticles.id,
      publicId: kbArticles.publicId,
      title: kbArticles.title,
    });

  return result;
};

export const updateArticle = async (
  db: dbClient,
  input: {
    articlePublicId: string;
    title?: string;
    content?: string;
    categoryId?: number | null;
  },
) => {
  const [result] = await db
    .update(kbArticles)
    .set({
      title: input.title,
      content: input.content,
      categoryId: input.categoryId,
      updatedAt: new Date(),
    })
    .where(eq(kbArticles.publicId, input.articlePublicId))
    .returning({
      id: kbArticles.id,
      publicId: kbArticles.publicId,
      title: kbArticles.title,
    });

  return result;
};

export const softDeleteArticle = async (
  db: dbClient,
  args: { articleId: number; deletedAt: Date; deletedBy: string },
) => {
  const [result] = await db
    .update(kbArticles)
    .set({ deletedAt: args.deletedAt, deletedBy: args.deletedBy })
    .where(and(eq(kbArticles.id, args.articleId), isNull(kbArticles.deletedAt)))
    .returning({ id: kbArticles.id });

  return result;
};

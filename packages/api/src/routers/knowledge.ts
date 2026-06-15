import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as knowledgeRepo from "@kan/db/repository/knowledge.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { assertPermission } from "../utils/permissions";

const categorySchema = z.object({
  publicId: z.string(),
  name: z.string(),
});

const articleListItemSchema = z.object({
  publicId: z.string(),
  title: z.string(),
  category: categorySchema.nullable(),
});

const requireUser = (userId: string | undefined): string => {
  if (!userId)
    throw new TRPCError({
      message: `User not authenticated`,
      code: "UNAUTHORIZED",
    });
  return userId;
};

const getWorkspaceOrThrow = async (
  db: Parameters<typeof workspaceRepo.getByPublicId>[0],
  workspacePublicId: string,
) => {
  const workspace = await workspaceRepo.getByPublicId(db, workspacePublicId);
  if (!workspace)
    throw new TRPCError({
      message: `Workspace with public ID ${workspacePublicId} not found`,
      code: "NOT_FOUND",
    });
  return workspace;
};

export const knowledgeRouter = createTRPCRouter({
  // ─── Read: everything for a workspace ──────────────────────
  byWorkspace: protectedProcedure
    .input(z.object({ workspacePublicId: z.string().min(12) }))
    .output(
      z.object({
        categories: z.array(categorySchema),
        articles: z.array(articleListItemSchema),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUser(ctx.user?.id);
      const workspace = await getWorkspaceOrThrow(
        ctx.db,
        input.workspacePublicId,
      );
      await assertPermission(ctx.db, userId, workspace.id, "workspace:view");

      const [categories, articles] = await Promise.all([
        knowledgeRepo.getCategoriesByWorkspaceId(ctx.db, workspace.id),
        knowledgeRepo.getArticlesByWorkspaceId(ctx.db, workspace.id),
      ]);

      return {
        categories: categories.map((c) => ({
          publicId: c.publicId,
          name: c.name,
        })),
        articles: articles.map((a) => ({
          publicId: a.publicId,
          title: a.title,
          category: a.category
            ? { publicId: a.category.publicId, name: a.category.name }
            : null,
        })),
      };
    }),
  articleByPublicId: protectedProcedure
    .input(z.object({ articlePublicId: z.string().min(12) }))
    .output(
      z.object({
        publicId: z.string(),
        title: z.string(),
        content: z.string(),
        category: categorySchema.nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = requireUser(ctx.user?.id);
      const article = await knowledgeRepo.getWorkspaceAndArticleIdByPublicId(
        ctx.db,
        input.articlePublicId,
      );
      if (!article)
        throw new TRPCError({
          message: `Article with public ID ${input.articlePublicId} not found`,
          code: "NOT_FOUND",
        });
      await assertPermission(ctx.db, userId, article.workspaceId, "workspace:view");

      const result = await knowledgeRepo.getArticleByPublicId(
        ctx.db,
        input.articlePublicId,
      );
      if (!result)
        throw new TRPCError({
          message: `Article with public ID ${input.articlePublicId} not found`,
          code: "NOT_FOUND",
        });

      return {
        publicId: result.publicId,
        title: result.title,
        content: result.content,
        category: result.category
          ? { publicId: result.category.publicId, name: result.category.name }
          : null,
      };
    }),

  // ─── Categories (write: any member) ────────────────────────
  createCategory: protectedProcedure
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        name: z.string().min(1).max(255),
      }),
    )
    .output(categorySchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUser(ctx.user?.id);
      const workspace = await getWorkspaceOrThrow(
        ctx.db,
        input.workspacePublicId,
      );
      await assertPermission(ctx.db, userId, workspace.id, "board:create");

      const result = await knowledgeRepo.createCategory(ctx.db, {
        name: input.name,
        workspaceId: workspace.id,
        createdBy: userId,
      });
      if (!result)
        throw new TRPCError({
          message: `Failed to create category`,
          code: "INTERNAL_SERVER_ERROR",
        });

      return { publicId: result.publicId, name: result.name };
    }),
  updateCategory: protectedProcedure
    .input(
      z.object({
        categoryPublicId: z.string().min(12),
        name: z.string().min(1).max(255),
      }),
    )
    .output(categorySchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUser(ctx.user?.id);
      const category = await knowledgeRepo.getWorkspaceAndCategoryIdByPublicId(
        ctx.db,
        input.categoryPublicId,
      );
      if (!category)
        throw new TRPCError({
          message: `Category with public ID ${input.categoryPublicId} not found`,
          code: "NOT_FOUND",
        });
      await assertPermission(ctx.db, userId, category.workspaceId, "board:create");

      const result = await knowledgeRepo.updateCategory(ctx.db, input);
      if (!result)
        throw new TRPCError({
          message: `Failed to update category`,
          code: "INTERNAL_SERVER_ERROR",
        });

      return { publicId: result.publicId, name: result.name };
    }),
  deleteCategory: protectedProcedure
    .input(z.object({ categoryPublicId: z.string().min(12) }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUser(ctx.user?.id);
      const category = await knowledgeRepo.getWorkspaceAndCategoryIdByPublicId(
        ctx.db,
        input.categoryPublicId,
      );
      if (!category)
        throw new TRPCError({
          message: `Category with public ID ${input.categoryPublicId} not found`,
          code: "NOT_FOUND",
        });
      await assertPermission(ctx.db, userId, category.workspaceId, "board:create");

      // Soft delete keeps the row, so detach its articles first.
      await knowledgeRepo.clearCategoryFromArticles(ctx.db, category.id);
      await knowledgeRepo.softDeleteCategory(ctx.db, {
        categoryId: category.id,
        deletedAt: new Date(),
        deletedBy: userId,
      });

      return { success: true };
    }),

  // ─── Articles (write: any member) ──────────────────────────
  createArticle: protectedProcedure
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        title: z.string().min(1).max(255),
        content: z.string().max(100000).optional(),
        categoryPublicId: z.string().min(12).nullable().optional(),
      }),
    )
    .output(z.object({ publicId: z.string(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUser(ctx.user?.id);
      const workspace = await getWorkspaceOrThrow(
        ctx.db,
        input.workspacePublicId,
      );
      await assertPermission(ctx.db, userId, workspace.id, "board:create");

      let categoryId: number | null = null;
      if (input.categoryPublicId) {
        const category =
          await knowledgeRepo.getWorkspaceAndCategoryIdByPublicId(
            ctx.db,
            input.categoryPublicId,
          );
        if (!category || category.workspaceId !== workspace.id)
          throw new TRPCError({
            message: `Category not found in this workspace`,
            code: "BAD_REQUEST",
          });
        categoryId = category.id;
      }

      const result = await knowledgeRepo.createArticle(ctx.db, {
        title: input.title,
        content: input.content ?? "",
        workspaceId: workspace.id,
        categoryId,
        createdBy: userId,
      });
      if (!result)
        throw new TRPCError({
          message: `Failed to create article`,
          code: "INTERNAL_SERVER_ERROR",
        });

      return { publicId: result.publicId, title: result.title };
    }),
  updateArticle: protectedProcedure
    .input(
      z.object({
        articlePublicId: z.string().min(12),
        title: z.string().min(1).max(255).optional(),
        content: z.string().max(100000).optional(),
        categoryPublicId: z.string().min(12).nullable().optional(),
      }),
    )
    .output(z.object({ publicId: z.string(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUser(ctx.user?.id);
      const article = await knowledgeRepo.getWorkspaceAndArticleIdByPublicId(
        ctx.db,
        input.articlePublicId,
      );
      if (!article)
        throw new TRPCError({
          message: `Article with public ID ${input.articlePublicId} not found`,
          code: "NOT_FOUND",
        });
      await assertPermission(ctx.db, userId, article.workspaceId, "board:create");

      // categoryPublicId: undefined = leave unchanged, null = uncategorize
      let categoryId: number | null | undefined = undefined;
      if (input.categoryPublicId === null) {
        categoryId = null;
      } else if (input.categoryPublicId) {
        const category =
          await knowledgeRepo.getWorkspaceAndCategoryIdByPublicId(
            ctx.db,
            input.categoryPublicId,
          );
        if (!category || category.workspaceId !== article.workspaceId)
          throw new TRPCError({
            message: `Category not found in this workspace`,
            code: "BAD_REQUEST",
          });
        categoryId = category.id;
      }

      const result = await knowledgeRepo.updateArticle(ctx.db, {
        articlePublicId: input.articlePublicId,
        title: input.title,
        content: input.content,
        categoryId,
      });
      if (!result)
        throw new TRPCError({
          message: `Failed to update article`,
          code: "INTERNAL_SERVER_ERROR",
        });

      return { publicId: result.publicId, title: result.title };
    }),
  deleteArticle: protectedProcedure
    .input(z.object({ articlePublicId: z.string().min(12) }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireUser(ctx.user?.id);
      const article = await knowledgeRepo.getWorkspaceAndArticleIdByPublicId(
        ctx.db,
        input.articlePublicId,
      );
      if (!article)
        throw new TRPCError({
          message: `Article with public ID ${input.articlePublicId} not found`,
          code: "NOT_FOUND",
        });
      await assertPermission(ctx.db, userId, article.workspaceId, "board:create");

      await knowledgeRepo.softDeleteArticle(ctx.db, {
        articleId: article.id,
        deletedAt: new Date(),
        deletedBy: userId,
      });

      return { success: true };
    }),
});

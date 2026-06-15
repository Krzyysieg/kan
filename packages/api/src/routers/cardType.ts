import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as cardRepo from "@kan/db/repository/card.repo";
import * as cardTypeRepo from "@kan/db/repository/cardType.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { assertPermission } from "../utils/permissions";

const cardTypeSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  colourCode: z.string().nullable(),
  icon: z.string().nullable(),
});

export const cardTypeRouter = createTRPCRouter({
  all: protectedProcedure
    .meta({
      openapi: {
        summary: "List card types for a workspace",
        method: "GET",
        path: "/workspaces/{workspacePublicId}/types",
        description: "Retrieves all card types for a given workspace",
        tags: ["Card Types"],
        protect: true,
      },
    })
    .input(z.object({ workspacePublicId: z.string().min(12) }))
    .output(z.array(cardTypeSchema))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );

      if (!workspace)
        throw new TRPCError({
          message: `Workspace with public ID ${input.workspacePublicId} not found`,
          code: "NOT_FOUND",
        });

      await assertPermission(ctx.db, userId, workspace.id, "workspace:view");

      return cardTypeRepo.getAllByWorkspaceId(ctx.db, workspace.id);
    }),
  create: protectedProcedure
    .meta({
      openapi: {
        summary: "Create a card type",
        method: "POST",
        path: "/workspaces/{workspacePublicId}/types",
        description: "Creates a new card type for a given workspace",
        tags: ["Card Types"],
        protect: true,
      },
    })
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        name: z.string().min(1).max(255),
        colourCode: z.string().length(7).nullable().optional(),
        icon: z.string().max(50).nullable().optional(),
      }),
    )
    .output(cardTypeSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );

      if (!workspace)
        throw new TRPCError({
          message: `Workspace with public ID ${input.workspacePublicId} not found`,
          code: "NOT_FOUND",
        });

      await assertPermission(ctx.db, userId, workspace.id, "board:edit");

      const result = await cardTypeRepo.create(ctx.db, {
        name: input.name,
        colourCode: input.colourCode,
        icon: input.icon,
        createdBy: userId,
        workspaceId: workspace.id,
      });

      if (!result)
        throw new TRPCError({
          message: `Failed to create card type`,
          code: "INTERNAL_SERVER_ERROR",
        });

      return result;
    }),
  update: protectedProcedure
    .meta({
      openapi: {
        summary: "Update a card type",
        method: "PUT",
        path: "/types/{cardTypePublicId}",
        description: "Updates a card type by its public ID",
        tags: ["Card Types"],
        protect: true,
      },
    })
    .input(
      z.object({
        cardTypePublicId: z.string().min(12),
        name: z.string().min(1).max(255).optional(),
        colourCode: z.string().length(7).nullable().optional(),
        icon: z.string().max(50).nullable().optional(),
      }),
    )
    .output(cardTypeSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const cardType = await cardTypeRepo.getWorkspaceAndCardTypeIdByPublicId(
        ctx.db,
        input.cardTypePublicId,
      );

      if (!cardType)
        throw new TRPCError({
          message: `Card type with public ID ${input.cardTypePublicId} not found`,
          code: "NOT_FOUND",
        });

      await assertPermission(
        ctx.db,
        userId,
        cardType.workspaceId,
        "board:edit",
      );

      const result = await cardTypeRepo.update(ctx.db, input);

      if (!result)
        throw new TRPCError({
          message: `Failed to update card type`,
          code: "INTERNAL_SERVER_ERROR",
        });

      return result;
    }),
  delete: protectedProcedure
    .meta({
      openapi: {
        summary: "Delete a card type",
        method: "DELETE",
        path: "/types/{cardTypePublicId}",
        description: "Deletes a card type by its public ID",
        tags: ["Card Types"],
        protect: true,
      },
    })
    .input(z.object({ cardTypePublicId: z.string().min(12) }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const cardType = await cardTypeRepo.getWorkspaceAndCardTypeIdByPublicId(
        ctx.db,
        input.cardTypePublicId,
      );

      if (!cardType)
        throw new TRPCError({
          message: `Card type with public ID ${input.cardTypePublicId} not found`,
          code: "NOT_FOUND",
        });

      await assertPermission(
        ctx.db,
        userId,
        cardType.workspaceId,
        "board:edit",
      );

      // Soft delete keeps the row, so clear references from cards first
      await cardRepo.clearCardTypeFromCards(ctx.db, cardType.id);

      await cardTypeRepo.softDelete(ctx.db, {
        cardTypeId: cardType.id,
        deletedAt: new Date(),
        deletedBy: userId,
      });

      return { success: true };
    }),
});

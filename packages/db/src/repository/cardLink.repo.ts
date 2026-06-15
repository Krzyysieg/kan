import { and, eq } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import type { CardLinkType } from "@kan/db/schema";
import { cardLinks } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export const create = async (
  db: dbClient,
  input: {
    sourceCardId: number;
    targetCardId: number;
    type: CardLinkType;
    createdBy: string;
  },
) => {
  const [result] = await db
    .insert(cardLinks)
    .values({
      publicId: generateUID(),
      sourceCardId: input.sourceCardId,
      targetCardId: input.targetCardId,
      type: input.type,
      createdBy: input.createdBy,
    })
    .returning({
      id: cardLinks.id,
      publicId: cardLinks.publicId,
    });

  return result;
};

export const getExisting = (
  db: dbClient,
  input: {
    sourceCardId: number;
    targetCardId: number;
    type: CardLinkType;
  },
) => {
  return db.query.cardLinks.findFirst({
    columns: { id: true, publicId: true },
    where: and(
      eq(cardLinks.sourceCardId, input.sourceCardId),
      eq(cardLinks.targetCardId, input.targetCardId),
      eq(cardLinks.type, input.type),
    ),
  });
};

export const getWorkspaceAndLinkIdByPublicId = async (
  db: dbClient,
  cardLinkPublicId: string,
) => {
  const result = await db.query.cardLinks.findFirst({
    columns: { id: true },
    where: eq(cardLinks.publicId, cardLinkPublicId),
    with: {
      sourceCard: {
        columns: { id: true },
        with: {
          list: {
            columns: { id: true },
            with: { board: { columns: { workspaceId: true } } },
          },
        },
      },
    },
  });

  return result
    ? {
        id: result.id,
        workspaceId: result.sourceCard.list.board.workspaceId,
      }
    : null;
};

export const deleteByPublicId = async (
  db: dbClient,
  cardLinkPublicId: string,
) => {
  const [result] = await db
    .delete(cardLinks)
    .where(eq(cardLinks.publicId, cardLinkPublicId))
    .returning({ id: cardLinks.id });

  return result;
};

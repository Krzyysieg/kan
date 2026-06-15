import { and, eq, isNull } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { cardTypes } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export const create = async (
  db: dbClient,
  cardTypeInput: {
    name: string;
    colourCode?: string | null;
    icon?: string | null;
    createdBy: string;
    workspaceId: number;
  },
) => {
  const [result] = await db
    .insert(cardTypes)
    .values({
      publicId: generateUID(),
      name: cardTypeInput.name,
      colourCode: cardTypeInput.colourCode ?? null,
      icon: cardTypeInput.icon ?? null,
      createdBy: cardTypeInput.createdBy,
      workspaceId: cardTypeInput.workspaceId,
    })
    .returning({
      id: cardTypes.id,
      publicId: cardTypes.publicId,
      name: cardTypes.name,
      colourCode: cardTypes.colourCode,
      icon: cardTypes.icon,
    });

  return result;
};

export const getAllByWorkspaceId = (db: dbClient, workspaceId: number) => {
  return db.query.cardTypes.findMany({
    columns: {
      publicId: true,
      name: true,
      colourCode: true,
      icon: true,
    },
    where: and(
      eq(cardTypes.workspaceId, workspaceId),
      isNull(cardTypes.deletedAt),
    ),
    orderBy: (cardTypes, { asc }) => [asc(cardTypes.name)],
  });
};

export const getByPublicId = (db: dbClient, cardTypePublicId: string) => {
  return db.query.cardTypes.findFirst({
    columns: {
      id: true,
      publicId: true,
      name: true,
      colourCode: true,
      icon: true,
    },
    where: eq(cardTypes.publicId, cardTypePublicId),
  });
};

export const getWorkspaceAndCardTypeIdByPublicId = async (
  db: dbClient,
  cardTypePublicId: string,
) => {
  const result = await db.query.cardTypes.findFirst({
    columns: { id: true, workspaceId: true },
    where: eq(cardTypes.publicId, cardTypePublicId),
  });

  return result
    ? {
        id: result.id,
        workspaceId: result.workspaceId,
      }
    : null;
};

export const update = async (
  db: dbClient,
  cardTypeInput: {
    cardTypePublicId: string;
    name?: string;
    colourCode?: string | null;
    icon?: string | null;
  },
) => {
  const [result] = await db
    .update(cardTypes)
    .set({
      name: cardTypeInput.name,
      colourCode: cardTypeInput.colourCode,
      icon: cardTypeInput.icon,
      updatedAt: new Date(),
    })
    .where(eq(cardTypes.publicId, cardTypeInput.cardTypePublicId))
    .returning({
      id: cardTypes.id,
      publicId: cardTypes.publicId,
      name: cardTypes.name,
      colourCode: cardTypes.colourCode,
      icon: cardTypes.icon,
    });

  return result;
};

export const softDelete = async (
  db: dbClient,
  args: {
    cardTypeId: number;
    deletedAt: Date;
    deletedBy: string;
  },
) => {
  const [result] = await db
    .update(cardTypes)
    .set({
      deletedAt: args.deletedAt,
      deletedBy: args.deletedBy,
    })
    .where(
      and(eq(cardTypes.id, args.cardTypeId), isNull(cardTypes.deletedAt)),
    )
    .returning({ id: cardTypes.id });

  return result;
};

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import {
  cardActivities,
  cardAttachments,
  cards,
  cardsToLabels,
  cardToWorkspaceMembers,
  cardTypes,
  checklistItems,
  checklists,
  labels,
  lists,
  workspaceMembers,
  workspaces,
} from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export const getCount = async (db: dbClient) => {
  const result = await db
    .select({ count: count() })
    .from(cards)
    .where(isNull(cards.deletedAt));

  return result[0]?.count ?? 0;
};

export const create = async (
  db: dbClient,
  cardInput: {
    title: string;
    description: string;
    createdBy: string;
    listId: number;
    workspaceId: number;
    position: "start" | "end";
    dueDate?: Date | null;
    parentCardId?: number | null;
  },
) => {
  return db.transaction(async (tx) => {
    let index = 0;

    if (cardInput.position === "end") {
      const lastCard = await tx.query.cards.findFirst({
        columns: {
          index: true,
        },
        where: and(eq(cards.listId, cardInput.listId), isNull(cards.deletedAt)),
        orderBy: desc(cards.index),
      });

      if (lastCard) index = lastCard.index + 1;
    }

    const getExistingCardAtIndex = async () =>
      tx.query.cards.findFirst({
        columns: {
          id: true,
        },
        where: and(
          eq(cards.listId, cardInput.listId),
          eq(cards.index, index),
          isNull(cards.deletedAt),
        ),
      });

    const existingCardAtIndex = await getExistingCardAtIndex();

    if (existingCardAtIndex?.id) {
      await tx.execute(sql`
        UPDATE card
        SET index = index + 1
        WHERE "listId" = ${cardInput.listId} AND index >= ${index} AND "deletedAt" IS NULL;
      `);
    }

    const [counterResult] = await tx
      .update(workspaces)
      .set({ cardCounter: sql`${workspaces.cardCounter} + 1` })
      .where(eq(workspaces.id, cardInput.workspaceId))
      .returning({ cardCounter: workspaces.cardCounter });

    if (!counterResult)
      throw new Error(`Workspace ${cardInput.workspaceId} not found`);

    const cardNumber = counterResult.cardCounter;

    const result = await tx
      .insert(cards)
      .values({
        publicId: generateUID(),
        title: cardInput.title,
        description: cardInput.description,
        createdBy: cardInput.createdBy,
        listId: cardInput.listId,
        index: index,
        cardNumber,
        dueDate: cardInput.dueDate ?? null,
        parentCardId: cardInput.parentCardId ?? null,
      })
      .returning({
        id: cards.id,
        listId: cards.listId,
        publicId: cards.publicId,
        cardNumber: cards.cardNumber,
      });

    if (!result[0]) throw new Error("Unable to create card");

    await tx.insert(cardActivities).values({
      publicId: generateUID(),
      cardId: result[0].id,
      type: "card.created",
      createdBy: cardInput.createdBy,
    });

    const countExpr = sql<number>`COUNT(*)`.mapWith(Number);

    const duplicateIndices = await tx
      .select({
        index: cards.index,
        count: countExpr,
      })
      .from(cards)
      .where(and(eq(cards.listId, result[0].listId), isNull(cards.deletedAt)))
      .groupBy(cards.listId, cards.index)
      .having(gt(countExpr, 1));

    if (duplicateIndices.length > 0) {
      // Compact indices for this list to sequential values (0..n-1) preserving order
      await tx.execute(sql`
        WITH ordered AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY "index", id) - 1 AS new_index
          FROM "card"
          WHERE "listId" = ${result[0].listId} AND "deletedAt" IS NULL
        )
        UPDATE "card" c
        SET "index" = o.new_index
        FROM ordered o
        WHERE c.id = o.id;
      `);

      // Last resort: verify fix; rollback if duplicates persist
      const postFixDupes = await tx
        .select({ index: cards.index, count: countExpr })
        .from(cards)
        .where(and(eq(cards.listId, result[0].listId), isNull(cards.deletedAt)))
        .groupBy(cards.listId, cards.index)
        .having(gt(countExpr, 1));

      if (postFixDupes.length > 0) {
        throw new Error(
          `Invariant violation: duplicate card indices remain after compaction in list ${result[0].listId}`,
        );
      }
    }

    return result[0];
  });
};

export const bulkCreateCardLabelRelationships = async (
  db: dbClient,
  cardLabelRelationshipInput: {
    cardId: number;
    labelId: number;
  }[],
) => {
  const result = await db
    .insert(cardsToLabels)
    .values(cardLabelRelationshipInput)
    .returning();

  return result;
};

export const bulkCreateCardWorkspaceMemberRelationships = async (
  db: dbClient,
  cardWorkspaceMemberRelationshipInput: {
    cardId: number;
    workspaceMemberId: number;
  }[],
) => {
  const result = await db
    .insert(cardToWorkspaceMembers)
    .values(cardWorkspaceMemberRelationshipInput)
    .returning();

  return result;
};

export const update = async (
  db: dbClient,
  cardInput: {
    title?: string;
    description?: string;
    dueDate?: Date | null;
  },
  args: {
    cardPublicId: string;
  },
) => {
  const [result] = await db
    .update(cards)
    .set({
      title: cardInput.title,
      description: cardInput.description,
      dueDate: cardInput.dueDate !== undefined ? cardInput.dueDate : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(cards.publicId, args.cardPublicId), isNull(cards.deletedAt)))
    .returning({
      id: cards.id,
      publicId: cards.publicId,
      title: cards.title,
      description: cards.description,
      dueDate: cards.dueDate,
    });

  return result;
};

export const setType = async (
  db: dbClient,
  args: {
    cardPublicId: string;
    cardTypeId: number | null;
  },
) => {
  const [result] = await db
    .update(cards)
    .set({
      cardTypeId: args.cardTypeId,
      updatedAt: new Date(),
    })
    .where(and(eq(cards.publicId, args.cardPublicId), isNull(cards.deletedAt)))
    .returning({
      id: cards.id,
      publicId: cards.publicId,
      cardTypeId: cards.cardTypeId,
    });

  return result;
};

export const getParentCardIdById = async (db: dbClient, cardId: number) => {
  const result = await db.query.cards.findFirst({
    columns: { parentCardId: true },
    where: eq(cards.id, cardId),
  });

  return result?.parentCardId ?? null;
};

export const hasChildren = async (db: dbClient, cardId: number) => {
  const child = await db.query.cards.findFirst({
    columns: { id: true },
    where: and(eq(cards.parentCardId, cardId), isNull(cards.deletedAt)),
  });

  return !!child;
};

/**
 * Reorders a list so each sub-task sits immediately after its parent, keeping
 * the board tidy. Relative order of top-level cards is preserved; sub-tasks
 * whose parent is not in this list are treated as standalone.
 */
export const normalizeListOrder = async (db: dbClient, listId: number) => {
  const listCards = await db
    .select({
      id: cards.id,
      parentCardId: cards.parentCardId,
    })
    .from(cards)
    .where(and(eq(cards.listId, listId), isNull(cards.deletedAt)))
    .orderBy(asc(cards.index), asc(cards.id));

  if (listCards.length === 0) return;

  const inList = new Set(listCards.map((c) => c.id));
  const childrenByParent = new Map<number, number[]>();
  const anchors: number[] = [];

  for (const c of listCards) {
    if (c.parentCardId !== null && inList.has(c.parentCardId)) {
      const existing = childrenByParent.get(c.parentCardId);
      if (existing) existing.push(c.id);
      else childrenByParent.set(c.parentCardId, [c.id]);
    } else {
      anchors.push(c.id);
    }
  }

  const ordered: number[] = [];
  const seen = new Set<number>();
  const push = (id: number) => {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  };
  for (const anchorId of anchors) {
    push(anchorId);
    for (const childId of childrenByParent.get(anchorId) ?? []) push(childId);
  }
  // Safety net: append anything not captured (e.g. pre-existing deep nesting).
  for (const c of listCards) push(c.id);

  // Nothing to do if already in order.
  const alreadyOrdered = ordered.every((id, i) => listCards[i]?.id === id);
  if (alreadyOrdered) return;

  const values = ordered.map((id, i) => sql`(${id}::bigint, ${i}::int)`);
  await db.execute(sql`
    UPDATE "card" AS c
    SET "index" = v.new_index
    FROM (VALUES ${sql.join(values, sql`, `)}) AS v(id, new_index)
    WHERE c.id = v.id;
  `);
};

export const setParent = async (
  db: dbClient,
  args: {
    cardPublicId: string;
    parentCardId: number | null;
  },
) => {
  const [result] = await db
    .update(cards)
    .set({
      parentCardId: args.parentCardId,
      updatedAt: new Date(),
    })
    .where(and(eq(cards.publicId, args.cardPublicId), isNull(cards.deletedAt)))
    .returning({
      id: cards.id,
      publicId: cards.publicId,
      parentCardId: cards.parentCardId,
    });

  return result;
};

export const clearCardTypeFromCards = async (
  db: dbClient,
  cardTypeId: number,
) => {
  await db
    .update(cards)
    .set({ cardTypeId: null })
    .where(eq(cards.cardTypeId, cardTypeId));
};

export const getCardWithListByPublicId = (
  db: dbClient,
  cardPublicId: string,
) => {
  return db.query.cards.findFirst({
    columns: {
      id: true,
      index: true,
    },
    with: {
      list: {
        columns: {
          id: true,
          boardId: true,
        },
      },
    },
    where: and(eq(cards.publicId, cardPublicId), isNull(cards.deletedAt)),
  });
};

export const getByPublicId = (db: dbClient, cardPublicId: string) => {
  return db.query.cards.findFirst({
    columns: {
      id: true,
      publicId: true,
      title: true,
      description: true,
      listId: true,
      dueDate: true,
    },
    with: {
      list: {
        columns: {
          publicId: true,
          name: true,
        },
      },
    },
    where: eq(cards.publicId, cardPublicId),
  });
};

export const getCardLabelRelationship = async (
  db: dbClient,
  args: { cardId: number; labelId: number },
) => {
  return db.query.cardsToLabels.findFirst({
    where: and(
      eq(cardsToLabels.cardId, args.cardId),
      eq(cardsToLabels.labelId, args.labelId),
    ),
  });
};

export const bulkCreate = async (
  db: dbClient,
  cardInput: {
    publicId: string;
    title: string;
    description: string;
    createdBy: string;
    listId: number;
    workspaceId: number;
    index: number;
    importId?: number;
  }[],
) => {
  if (cardInput.length === 0) return [];

  return db.transaction(async (tx) => {
    // Group incoming cards by list to compute safe, sequential indices per list
    const byList = new Map<number, typeof cardInput>();
    for (const item of cardInput) {
      const arr = byList.get(item.listId) ?? [];
      arr.push(item);
      byList.set(item.listId, arr);
    }

    // Atomically reserve a contiguous range of cardNumbers per workspace by
    // bumping cardCounter once per workspace.
    const countsByWorkspace = new Map<number, number>();
    for (const item of cardInput) {
      countsByWorkspace.set(
        item.workspaceId,
        (countsByWorkspace.get(item.workspaceId) ?? 0) + 1,
      );
    }

    const cardNumberByWorkspaceQueue = new Map<number, number[]>();
    for (const [workspaceId, count] of countsByWorkspace.entries()) {
      const [counterResult] = await tx
        .update(workspaces)
        .set({ cardCounter: sql`${workspaces.cardCounter} + ${count}` })
        .where(eq(workspaces.id, workspaceId))
        .returning({ cardCounter: workspaces.cardCounter });

      if (!counterResult) throw new Error(`Workspace ${workspaceId} not found`);

      const last = counterResult.cardCounter;
      const start = last - count + 1;
      const queue: number[] = [];
      for (let n = start; n <= last; n++) queue.push(n);
      cardNumberByWorkspaceQueue.set(workspaceId, queue);
    }

    const allValuesToInsert: {
      publicId: string;
      title: string;
      description: string;
      createdBy: string;
      listId: number;
      index: number;
      cardNumber: number;
      importId?: number;
    }[] = [];

    // For each list, append incoming cards after current max index, preserving incoming order
    for (const [listId, items] of byList.entries()) {
      const last = await tx.query.cards.findFirst({
        columns: { index: true },
        where: and(eq(cards.listId, listId), isNull(cards.deletedAt)),
        orderBy: [desc(cards.index)],
      });

      let nextIndex = last ? last.index + 1 : 0;
      const sorted = [...items].sort((a, b) => a.index - b.index);
      for (const it of sorted) {
        const queue = cardNumberByWorkspaceQueue.get(it.workspaceId);
        const cardNumber = queue?.shift();
        if (cardNumber === undefined)
          throw new Error(
            `Failed to allocate cardNumber for workspace ${it.workspaceId}`,
          );
        allValuesToInsert.push({
          publicId: it.publicId,
          title: it.title,
          description: it.description,
          createdBy: it.createdBy,
          listId: it.listId,
          index: nextIndex++,
          cardNumber,
          importId: it.importId,
        });
      }
    }

    const inserted = await tx
      .insert(cards)
      .values(allValuesToInsert)
      .returning({ id: cards.id });

    // Post-insert: compact per list if duplicates exist; then verify
    const countExpr = sql<number>`COUNT(*)`.mapWith(Number);
    for (const listId of byList.keys()) {
      const duplicateIndices = await tx
        .select({ index: cards.index, count: countExpr })
        .from(cards)
        .where(and(eq(cards.listId, listId), isNull(cards.deletedAt)))
        .groupBy(cards.listId, cards.index)
        .having(gt(countExpr, 1));

      if (duplicateIndices.length > 0) {
        await tx.execute(sql`
          WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY "index", id) - 1 AS new_index
            FROM "card"
            WHERE "listId" = ${listId} AND "deletedAt" IS NULL
          )
          UPDATE "card" c
          SET "index" = o.new_index
          FROM ordered o
          WHERE c.id = o.id;
        `);

        const postFixDupes = await tx
          .select({ index: cards.index, count: countExpr })
          .from(cards)
          .where(and(eq(cards.listId, listId), isNull(cards.deletedAt)))
          .groupBy(cards.listId, cards.index)
          .having(gt(countExpr, 1));

        if (postFixDupes.length > 0) {
          throw new Error(
            `Invariant violation: duplicate card indices remain after compaction in list ${listId}`,
          );
        }
      }
    }

    return inserted;
  });
};

export const createCardLabelRelationship = async (
  db: dbClient,
  cardLabelRelationshipInput: { cardId: number; labelId: number },
) => {
  const [result] = await db
    .insert(cardsToLabels)
    .values({
      cardId: cardLabelRelationshipInput.cardId,
      labelId: cardLabelRelationshipInput.labelId,
    })
    .returning();

  return result;
};

export const bulkCreateCardLabelRelationship = async (
  db: dbClient,
  cardLabelRelationshipInput: { cardId: number; labelId: number }[],
) => {
  const [result] = await db
    .insert(cardsToLabels)
    .values(cardLabelRelationshipInput)
    .returning();

  return result;
};

export const getCardMemberRelationship = (
  db: dbClient,
  args: { cardId: number; memberId: number },
) => {
  return db.query.cardToWorkspaceMembers.findFirst({
    where: and(
      eq(cardToWorkspaceMembers.cardId, args.cardId),
      eq(cardToWorkspaceMembers.workspaceMemberId, args.memberId),
    ),
  });
};

export const createCardMemberRelationship = async (
  db: dbClient,
  cardMemberRelationshipInput: { cardId: number; memberId: number },
) => {
  const [result] = await db
    .insert(cardToWorkspaceMembers)
    .values({
      cardId: cardMemberRelationshipInput.cardId,
      workspaceMemberId: cardMemberRelationshipInput.memberId,
    })
    .returning();

  return { success: !!result };
};

export const getWithListAndMembersByPublicId = async (
  db: dbClient,
  cardPublicId: string,
) => {
  const card = await db.query.cards.findFirst({
    columns: {
      id: true,
      publicId: true,
      title: true,
      description: true,
      dueDate: true,
      createdBy: true,
      cardNumber: true,
      index: true,
    },
    with: {
      labels: {
        with: {
          label: {
            columns: {
              publicId: true,
              name: true,
              colourCode: true,
            },
          },
        },
      },
      type: {
        columns: {
          publicId: true,
          name: true,
          colourCode: true,
          icon: true,
        },
      },
      parent: {
        columns: {
          publicId: true,
          title: true,
        },
      },
      children: {
        columns: {
          publicId: true,
          title: true,
          cardNumber: true,
        },
        where: isNull(cards.deletedAt),
        orderBy: asc(cards.index),
        with: {
          list: {
            columns: {
              publicId: true,
              name: true,
            },
          },
        },
      },
      outgoingLinks: {
        columns: {
          publicId: true,
          type: true,
        },
        with: {
          targetCard: {
            columns: {
              publicId: true,
              title: true,
              cardNumber: true,
              deletedAt: true,
            },
          },
        },
      },
      incomingLinks: {
        columns: {
          publicId: true,
          type: true,
        },
        with: {
          sourceCard: {
            columns: {
              publicId: true,
              title: true,
              cardNumber: true,
              deletedAt: true,
            },
          },
        },
      },
      attachments: {
        columns: {
          publicId: true,
          contentType: true,
          s3Key: true,
          originalFilename: true,
          size: true,
        },
        where: isNull(cardAttachments.deletedAt),
        orderBy: asc(cardAttachments.createdAt),
      },
      checklists: {
        columns: {
          publicId: true,
          name: true,
          index: true,
        },
        where: isNull(checklists.deletedAt),
        orderBy: asc(checklists.index),
        with: {
          items: {
            columns: {
              publicId: true,
              title: true,
              completed: true,
              index: true,
            },
            where: isNull(checklistItems.deletedAt),
            orderBy: asc(checklistItems.index),
          },
        },
      },
      list: {
        columns: {
          publicId: true,
          name: true,
        },
        with: {
          board: {
            columns: {
              publicId: true,
              name: true,
            },
            with: {
              labels: {
                columns: {
                  publicId: true,
                  colourCode: true,
                  name: true,
                },
                where: isNull(labels.deletedAt),
              },
              lists: {
                columns: {
                  publicId: true,
                  name: true,
                },
                where: isNull(lists.deletedAt),
                orderBy: asc(lists.index),
              },
              workspace: {
                columns: {
                  publicId: true,
                  cardPrefix: true,
                },
                with: {
                  cardTypes: {
                    columns: {
                      publicId: true,
                      name: true,
                      colourCode: true,
                      icon: true,
                    },
                    where: isNull(cardTypes.deletedAt),
                    orderBy: asc(cardTypes.name),
                  },
                  members: {
                    columns: {
                      publicId: true,
                      email: true,
                      status: true,
                    },
                    with: {
                      user: {
                        columns: {
                          id: true,
                          name: true,
                          email: true,
                          image: true,
                        },
                      },
                    },
                    where: isNull(workspaceMembers.deletedAt),
                  },
                },
              },
            },
          },
        },
        // https://github.com/drizzle-team/drizzle-orm/issues/2903
        // where: isNull(lists.deletedAt),
      },
      members: {
        with: {
          member: {
            columns: {
              publicId: true,
              email: true,
            },
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
            // https://github.com/drizzle-team/drizzle-orm/issues/2903
            // where: isNull(workspaceMembers.deletedAt),
          },
        },
      },
      activities: {
        columns: {
          publicId: true,
          type: true,
          createdAt: true,
          fromIndex: true,
          toIndex: true,
          fromTitle: true,
          toTitle: true,
          fromDescription: true,
          toDescription: true,
          fromDueDate: true,
          toDueDate: true,
        },
        with: {
          fromList: {
            columns: {
              publicId: true,
              name: true,
              index: true,
            },
          },
          toList: {
            columns: {
              publicId: true,
              name: true,
              index: true,
            },
          },
          label: {
            columns: {
              publicId: true,
              name: true,
            },
          },
          member: {
            columns: {
              publicId: true,
            },
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          comment: {
            columns: {
              publicId: true,
              comment: true,
              createdBy: true,
              updatedAt: true,
              deletedAt: true,
            },
            // https://github.com/drizzle-team/drizzle-orm/issues/2903
            // where: isNull(comments.deletedAt),
          },
        },
      },
    },
    where: and(eq(cards.publicId, cardPublicId), isNull(cards.deletedAt)),
  });

  if (!card) return null;

  // Flatten directed links into a single list from this card's perspective.
  // Incoming links get the inverse relationship label.
  const inverseRelationship = {
    blocks: "blocked_by",
    relates_to: "relates_to",
    duplicates: "duplicated_by",
  } as const;

  const outgoing = card.outgoingLinks
    .filter((link) => !link.targetCard.deletedAt)
    .map((link) => ({
      publicId: link.publicId,
      relationship: link.type,
      card: {
        publicId: link.targetCard.publicId,
        title: link.targetCard.title,
        cardNumber: link.targetCard.cardNumber,
      },
    }));

  const incoming = card.incomingLinks
    .filter((link) => !link.sourceCard.deletedAt)
    .map((link) => ({
      publicId: link.publicId,
      relationship: inverseRelationship[link.type],
      card: {
        publicId: link.sourceCard.publicId,
        title: link.sourceCard.title,
        cardNumber: link.sourceCard.cardNumber,
      },
    }));

  const { outgoingLinks, incomingLinks, ...rest } = card;

  const formattedResult = {
    ...rest,
    labels: card.labels.map((label) => label.label),
    members: card.members.map((member) => member.member),
    activities: card.activities.filter(
      (activity) => !activity.comment?.deletedAt,
    ),
    links: [...outgoing, ...incoming],
  };

  return formattedResult;
};

export const reorder = async (
  db: dbClient,
  args: {
    newListId: number | undefined;
    newIndex: number | undefined;
    cardId: number;
  },
) => {
  return db.transaction(async (tx) => {
    const card = await tx.query.cards.findFirst({
      columns: {
        id: true,
        index: true,
      },
      where: and(eq(cards.id, args.cardId), isNull(cards.deletedAt)),
      with: {
        list: {
          columns: {
            id: true,
            index: true,
          },
        },
      },
    });

    if (!card?.list)
      throw new Error(`Card not found for public ID ${args.cardId}`);

    const currentList = card.list;
    const currentIndex = card.index;
    let newList:
      | { id: number; index: number; cards: { id: number; index: number }[] }
      | undefined;

    if (args.newListId) {
      newList = await tx.query.lists.findFirst({
        columns: {
          id: true,
          index: true,
        },
        with: {
          cards: {
            columns: {
              id: true,
              index: true,
            },
            orderBy: desc(cards.index),
            limit: 1,
          },
        },
        where: and(eq(lists.id, args.newListId), isNull(lists.deletedAt)),
      });

      if (!newList)
        throw new Error(`List not found for public ID ${args.newListId}`);
    }

    let newIndex = args.newIndex;

    if (newIndex === undefined) {
      const lastCardIndex = newList?.cards.length
        ? newList.cards[0]?.index
        : undefined;

      newIndex = lastCardIndex !== undefined ? lastCardIndex + 1 : 0;
    }

    // When moving a card to a different list, its sub-tasks that live in the
    // same (source) list should travel with it.
    const isCrossListMove = !!newList && newList.id !== currentList.id;
    const childCards = isCrossListMove
      ? await tx.query.cards.findMany({
          columns: { id: true },
          where: and(
            eq(cards.parentCardId, args.cardId),
            eq(cards.listId, currentList.id),
            isNull(cards.deletedAt),
          ),
          orderBy: asc(cards.index),
        })
      : [];
    const childIds = childCards.map((c) => c.id);

    if (currentList.id === newList?.id) {
      await tx.execute(sql`
        UPDATE card
        SET index =
          CASE
            WHEN index = ${currentIndex} THEN ${newIndex}
            WHEN ${currentIndex} < ${newIndex} AND index > ${currentIndex} AND index <= ${newIndex} THEN index - 1
            WHEN ${currentIndex} > ${newIndex} AND index >= ${newIndex} AND index < ${currentIndex} THEN index + 1
            ELSE index
          END
        WHERE "listId" = ${currentList.id} AND "deletedAt" IS NULL;
      `);
    } else {
      const groupCount = 1 + childIds.length;

      // Make room in the target list for the parent plus its sub-tasks.
      await tx.execute(sql`
        UPDATE card
        SET index = index + ${groupCount}
        WHERE "listId" = ${newList?.id} AND index >= ${newIndex} AND "deletedAt" IS NULL;
      `);

      // Place the parent at the drop position.
      await tx.execute(sql`
        UPDATE card
        SET "listId" = ${newList?.id}, index = ${newIndex}
        WHERE id = ${card.id} AND "deletedAt" IS NULL;
      `);

      // Place its sub-tasks immediately after it, preserving their order.
      for (let i = 0; i < childIds.length; i++) {
        await tx.execute(sql`
          UPDATE card
          SET "listId" = ${newList?.id}, index = ${newIndex + 1 + i}
          WHERE id = ${childIds[i]} AND "deletedAt" IS NULL;
        `);
      }

      // Compact the source list to close the gaps left by the moved group.
      await tx.execute(sql`
        WITH ordered AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY "index", id) - 1 AS new_index
          FROM "card"
          WHERE "listId" = ${currentList.id} AND "deletedAt" IS NULL
        )
        UPDATE "card" c
        SET "index" = o.new_index
        FROM ordered o
        WHERE c.id = o.id;
      `);
    }

    const countExpr = sql<number>`COUNT(*)`.mapWith(Number);

    const duplicateIndices = await tx
      .select({
        index: cards.index,
        count: countExpr,
      })
      .from(cards)
      .where(
        and(
          inArray(
            cards.listId,
            [currentList.id, newList?.id].filter((id) => id !== undefined),
          ),
          isNull(cards.deletedAt),
        ),
      )
      .groupBy(cards.listId, cards.index)
      .having(gt(countExpr, 1));

    if (duplicateIndices.length > 0) {
      // Auto-heal by compacting indices for the affected list(s)
      const affectedListIds = [currentList.id, newList?.id].filter(
        (id): id is number => id !== undefined,
      );

      if (affectedListIds.length === 1) {
        await tx.execute(sql`
          WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY "index", id) - 1 AS new_index
            FROM "card"
            WHERE "listId" = ${affectedListIds[0]} AND "deletedAt" IS NULL
          )
          UPDATE "card" c
          SET "index" = o.new_index
          FROM ordered o
          WHERE c.id = o.id;
        `);
      } else if (affectedListIds.length === 2) {
        await tx.execute(sql`
          WITH ordered AS (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY "listId" ORDER BY "index", id) - 1 AS new_index
            FROM "card"
            WHERE "listId" IN (${sql.join(affectedListIds, sql`,`)}) AND "deletedAt" IS NULL
          )
          UPDATE "card" c
          SET "index" = o.new_index
          FROM ordered o
          WHERE c.id = o.id;
        `);
      }

      // Verify fix and rollback if necessary
      const postFixDupes = await tx
        .select({ index: cards.index, count: countExpr })
        .from(cards)
        .where(
          and(inArray(cards.listId, affectedListIds), isNull(cards.deletedAt)),
        )
        .groupBy(cards.listId, cards.index)
        .having(gt(countExpr, 1));

      if (postFixDupes.length > 0) {
        throw new Error(
          `Invariant violation: duplicate card indices remain after compaction for card ${card.id}`,
        );
      }
    }

    const updatedCard = await tx.query.cards.findFirst({
      columns: {
        id: true,
        publicId: true,
        title: true,
        description: true,
        dueDate: true,
      },
      where: eq(cards.id, card.id),
    });

    return updatedCard;
  });
};

export const softDelete = async (
  db: dbClient,
  args: {
    cardId: number;
    deletedAt: Date;
    deletedBy: string;
  },
) => {
  return db.transaction(async (tx) => {
    // Collect the card plus all of its sub-task descendants (any depth) so
    // deleting a card also deletes its sub-tasks.
    const subtree = await tx.execute(sql`
      WITH RECURSIVE subtree AS (
        SELECT id, "listId"
        FROM card
        WHERE id = ${args.cardId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT c.id, c."listId"
        FROM card c
        INNER JOIN subtree s ON c."parentCardId" = s.id
        WHERE c."deletedAt" IS NULL
      )
      SELECT id, "listId" FROM subtree;
    `);

    const rows =
      (subtree as unknown as { rows: { id: number; listId: number }[] }).rows ??
      [];

    if (rows.length === 0)
      throw new Error(`Unable to soft delete card ID ${args.cardId}`);

    const ids = rows.map((r) => r.id);
    const affectedListIds = [...new Set(rows.map((r) => r.listId))];

    await tx
      .update(cards)
      .set({ deletedAt: args.deletedAt, deletedBy: args.deletedBy })
      .where(and(inArray(cards.id, ids), isNull(cards.deletedAt)));

    // Recompact indices for every affected list so positions stay 0..n-1
    // (a card and its sub-tasks may span multiple lists).
    for (const listId of affectedListIds) {
      await tx.execute(sql`
        WITH ordered AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY "index", id) - 1 AS new_index
          FROM "card"
          WHERE "listId" = ${listId} AND "deletedAt" IS NULL
        )
        UPDATE "card" c
        SET "index" = o.new_index
        FROM ordered o
        WHERE c.id = o.id;
      `);
    }

    return { id: args.cardId, deletedCount: ids.length };
  });
};

export const softDeleteAllByListIds = async (
  db: dbClient,
  args: {
    listIds: number[];
    deletedAt: Date;
    deletedBy: string;
  },
) => {
  const updatedCards = await db
    .update(cards)
    .set({ deletedAt: args.deletedAt, deletedBy: args.deletedBy })
    .where(and(inArray(cards.listId, args.listIds), isNull(cards.deletedAt)))
    .returning({
      id: cards.id,
    });

  return updatedCards;
};

export const hardDeleteCardMemberRelationship = async (
  db: dbClient,
  args: { cardId: number; memberId: number },
) => {
  const [result] = await db
    .delete(cardToWorkspaceMembers)
    .where(
      and(
        eq(cardToWorkspaceMembers.cardId, args.cardId),
        eq(cardToWorkspaceMembers.workspaceMemberId, args.memberId),
      ),
    )
    .returning();

  return { success: !!result };
};

export const hardDeleteCardLabelRelationship = async (
  db: dbClient,
  args: { cardId: number; labelId: number },
) => {
  const [result] = await db
    .delete(cardsToLabels)
    .where(
      and(
        eq(cardsToLabels.cardId, args.cardId),
        eq(cardsToLabels.labelId, args.labelId),
      ),
    )
    .returning();

  return result;
};

export const hardDeleteAllCardLabelRelationships = async (
  db: dbClient,
  labelId: number,
) => {
  const [result] = await db
    .delete(cardsToLabels)
    .where(eq(cardsToLabels.labelId, labelId))
    .returning();

  return result;
};

export const getWorkspaceAndCardIdByCardPublicId = async (
  db: dbClient,
  cardPublicId: string,
) => {
  const result = await db.query.cards.findFirst({
    columns: { id: true, createdBy: true },
    where: and(eq(cards.publicId, cardPublicId), isNull(cards.deletedAt)),
    with: {
      list: {
        columns: { name: true, publicId: true },
        with: {
          board: {
            columns: {
              publicId: true,
              workspaceId: true,
              visibility: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return result
    ? {
        id: result.id,
        createdBy: result.createdBy,
        workspaceId: result.list.board.workspaceId,
        workspaceVisibility: result.list.board.visibility,
        listPublicId: result.list.publicId,
        listName: result.list.name,
        boardPublicId: result.list.board.publicId,
        boardName: result.list.board.name,
      }
    : null;
};

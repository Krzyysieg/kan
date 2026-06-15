import Link from "next/link";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiPlus, HiXMark } from "react-icons/hi2";

import CheckboxDropdown from "~/components/CheckboxDropdown";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

type Relationship =
  | "blocks"
  | "blocked_by"
  | "relates_to"
  | "duplicates"
  | "duplicated_by";

interface CardLink {
  publicId: string;
  relationship: Relationship;
  card: {
    publicId: string;
    title: string;
    cardNumber: number | null;
  };
}

interface CardLinksProps {
  links: CardLink[];
  cardPublicId: string;
  boardPublicId: string;
  cardPrefix?: string;
  viewOnly?: boolean;
}

const relationshipLabel = (rel: Relationship): string => {
  switch (rel) {
    case "blocks":
      return t`Blocks`;
    case "blocked_by":
      return t`Blocked by`;
    case "relates_to":
      return t`Relates to`;
    case "duplicates":
      return t`Duplicates`;
    case "duplicated_by":
      return t`Duplicate of`;
  }
};

const relationshipOrder: Relationship[] = [
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicates",
  "duplicated_by",
];

export default function CardLinks({
  links,
  cardPublicId,
  boardPublicId,
  cardPrefix,
  viewOnly = false,
}: CardLinksProps) {
  const utils = api.useUtils();
  const { showPopup } = usePopup();
  const [isAdding, setIsAdding] = useState(false);
  const [relationship, setRelationship] = useState<Relationship>("relates_to");

  const { data: board } = api.board.byId.useQuery(
    { boardPublicId },
    { enabled: isAdding && boardPublicId.length >= 12 },
  );

  const linkCard = api.card.linkCard.useMutation({
    onError: () => {
      showPopup({
        header: t`Unable to link card`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
    },
  });

  const unlinkCard = api.card.unlinkCard.useMutation({
    onMutate: async (vars) => {
      await utils.card.byId.cancel({ cardPublicId });
      const previous = utils.card.byId.getData({ cardPublicId });
      utils.card.byId.setData({ cardPublicId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          links: old.links.filter(
            (link) => link.publicId !== vars.cardLinkPublicId,
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous)
        utils.card.byId.setData({ cardPublicId }, ctx.previous);
      showPopup({
        header: t`Unable to remove link`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
    },
  });

  // Candidate cards to link: every card in the board except this one and
  // those already linked.
  const linkedPublicIds = new Set(links.map((link) => link.card.publicId));
  const candidateCards =
    board?.lists
      .flatMap((list) => list.cards)
      .filter(
        (c) =>
          c.publicId !== cardPublicId && !linkedPublicIds.has(c.publicId),
      ) ?? [];

  const relationshipItems = relationshipOrder.map((rel) => ({
    key: rel,
    value: relationshipLabel(rel),
    selected: rel === relationship,
  }));

  const cardItems = candidateCards.map((c) => ({
    key: c.publicId,
    value:
      cardPrefix && c.cardNumber != null
        ? `${cardPrefix}-${c.cardNumber} ${c.title}`
        : c.title,
    selected: false,
  }));

  // Render existing links grouped by relationship.
  const grouped = relationshipOrder
    .map((rel) => ({
      rel,
      items: links.filter((link) => link.relationship === rel),
    }))
    .filter((group) => group.items.length > 0);

  if (links.length === 0 && (viewOnly || !isAdding)) {
    if (viewOnly) return null;
    return (
      <div className="pb-4">
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 rounded-md p-1 text-sm text-light-900 hover:bg-light-100 dark:text-dark-700 dark:hover:bg-dark-100"
        >
          <HiPlus size={16} />
          {t`Add linked card`}
        </button>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-light-1000 dark:text-dark-1000">
          {t`Linked cards`}
        </h3>
        {!viewOnly && (
          <button
            onClick={() => setIsAdding((v) => !v)}
            className="rounded-md p-1 text-light-900 hover:bg-light-100 dark:text-dark-700 dark:hover:bg-dark-100"
            aria-label={t`Add linked card`}
          >
            <HiPlus size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {grouped.map((group) => (
          <div key={group.rel}>
            <p className="mb-1 text-xs font-medium text-light-700 dark:text-dark-800">
              {relationshipLabel(group.rel)}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((link) => (
                <div
                  key={link.publicId}
                  className="group flex items-center gap-2 rounded-md border border-light-200 px-2 py-1.5 dark:border-dark-200"
                >
                  <Link
                    href={`/cards/${link.card.publicId}`}
                    className="min-w-0 flex-1 truncate text-sm text-light-1000 hover:underline dark:text-dark-1000"
                  >
                    {cardPrefix && link.card.cardNumber != null && (
                      <span className="mr-2 text-xs text-light-700 dark:text-dark-800">
                        {cardPrefix}-{link.card.cardNumber}
                      </span>
                    )}
                    {link.card.title}
                  </Link>
                  {!viewOnly && (
                    <button
                      onClick={() =>
                        unlinkCard.mutate({ cardLinkPublicId: link.publicId })
                      }
                      className="invisible flex-shrink-0 rounded-md p-1 text-light-900 hover:bg-light-100 group-hover:visible dark:text-dark-700 dark:hover:bg-dark-100"
                      aria-label={t`Remove link`}
                    >
                      <HiXMark size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isAdding && !viewOnly && (
        <div className="mt-2 flex items-center gap-2">
          <CheckboxDropdown
            items={relationshipItems}
            handleSelect={(_, item) =>
              setRelationship(item.key as Relationship)
            }
            asChild
          >
            <div className="flex h-8 items-center rounded-[5px] border border-light-300 px-2 text-xs text-light-1000 dark:border-dark-500 dark:text-dark-1000">
              {relationshipLabel(relationship)}
            </div>
          </CheckboxDropdown>

          <CheckboxDropdown
            items={cardItems}
            handleSelect={(_, item) => {
              linkCard.mutate({
                cardPublicId,
                targetCardPublicId: item.key,
                relationship,
              });
              setIsAdding(false);
            }}
            createNewItemLabel={t`No cards available`}
            asChild
          >
            <div className="flex h-8 flex-1 items-center rounded-[5px] border border-light-300 px-2 text-xs text-light-900 dark:border-dark-500 dark:text-dark-800">
              {t`Select a card...`}
            </div>
          </CheckboxDropdown>
        </div>
      )}
    </div>
  );
}

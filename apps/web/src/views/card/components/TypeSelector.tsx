import { t } from "@lingui/core/macro";
import { HiMiniPlus } from "react-icons/hi2";

import Badge from "~/components/Badge";
import CheckboxDropdown from "~/components/CheckboxDropdown";
import LabelIcon from "~/components/LabelIcon";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

interface TypeSelectorProps {
  cardPublicId: string;
  types: {
    key: string;
    value: string;
    selected: boolean;
    colourCode: string | null;
  }[];
  isLoading: boolean;
  disabled?: boolean;
}

export default function TypeSelector({
  cardPublicId,
  types,
  isLoading,
  disabled = false,
}: TypeSelectorProps) {
  const utils = api.useUtils();
  const { openModal } = useModal();
  const { showPopup } = usePopup();

  const setType = api.card.setType.useMutation({
    onMutate: async (update) => {
      await utils.card.byId.cancel();

      const previousCard = utils.card.byId.getData({ cardPublicId });

      utils.card.byId.setData({ cardPublicId }, (oldCard) => {
        if (!oldCard) return oldCard;

        const nextType = update.cardTypePublicId
          ? (oldCard.list.board.workspace.cardTypes.find(
              (type) => type.publicId === update.cardTypePublicId,
            ) ?? null)
          : null;

        return {
          ...oldCard,
          type: nextType,
        };
      });

      return { previousCard };
    },
    onError: (_error, _update, context) => {
      utils.card.byId.setData({ cardPublicId }, context?.previousCard);
      showPopup({
        header: t`Unable to update type`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
      await utils.board.byId.invalidate();
    },
  });

  const selectedType = types.find((type) => type.selected);

  const dropdownItems = types.map((type) => ({
    key: type.key,
    value: type.value,
    selected: type.selected,
    leftIcon: <LabelIcon colourCode={type.colourCode} />,
  }));

  return (
    <>
      {isLoading ? (
        <div className="flex w-full">
          <div className="h-full w-[150px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
        </div>
      ) : (
        <CheckboxDropdown
          items={dropdownItems}
          handleSelect={(_, item) => {
            // Re-selecting the active type clears it
            const isCurrent = selectedType?.key === item.key;
            setType.mutate({
              cardPublicId,
              cardTypePublicId: isCurrent ? null : item.key,
            });
          }}
          handleEdit={
            disabled
              ? undefined
              : (cardTypePublicId) =>
                  openModal("EDIT_CARD_TYPE", cardTypePublicId)
          }
          handleCreate={disabled ? undefined : () => openModal("NEW_CARD_TYPE")}
          createNewItemLabel={t`Create new type`}
          disabled={disabled}
          asChild
        >
          {selectedType ? (
            <div className="flex flex-wrap gap-x-0.5">
              <Badge
                value={selectedType.value}
                iconLeft={<LabelIcon colourCode={selectedType.colourCode} />}
              />
            </div>
          ) : (
            <div
              className={`flex h-full w-full items-center rounded-[5px] border-[1px] border-light-50 pl-2 text-left text-sm text-neutral-900 dark:border-dark-50 dark:text-dark-1000 ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-light-300 hover:bg-light-200 dark:hover:border-dark-200 dark:hover:bg-dark-100"}`}
            >
              <HiMiniPlus size={22} className="pr-2" />
              {t`Add type`}
            </div>
          )}
        </CheckboxDropdown>
      )}
    </>
  );
}

import Link from "next/link";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiPlus, HiXMark } from "react-icons/hi2";

import { generateUID } from "@kan/shared/utils";

import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

interface Subtask {
  publicId: string;
  title: string;
  cardNumber: number | null;
  list: {
    publicId: string;
    name: string;
  };
}

interface SubtasksProps {
  subtasks: Subtask[];
  cardPublicId: string;
  listPublicId: string;
  cardPrefix?: string;
  viewOnly?: boolean;
}

export default function Subtasks({
  subtasks,
  cardPublicId,
  listPublicId,
  cardPrefix,
  viewOnly = false,
}: SubtasksProps) {
  const utils = api.useUtils();
  const { showPopup } = usePopup();
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");

  const createSubtask = api.card.create.useMutation({
    onMutate: async (vars) => {
      await utils.card.byId.cancel({ cardPublicId });
      const previous = utils.card.byId.getData({ cardPublicId });

      utils.card.byId.setData({ cardPublicId }, (old) => {
        if (!old) return old;
        const placeholder = {
          publicId: `PLACEHOLDER_${generateUID()}`,
          title: vars.title,
          cardNumber: null,
          list: { publicId: listPublicId, name: old.list.name },
        };
        return { ...old, children: [...old.children, placeholder] };
      });

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous)
        utils.card.byId.setData({ cardPublicId }, ctx.previous);
      showPopup({
        header: t`Unable to add sub-task`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
      await utils.board.byId.invalidate();
    },
  });

  const detachSubtask = api.card.setParent.useMutation({
    onMutate: async (vars) => {
      await utils.card.byId.cancel({ cardPublicId });
      const previous = utils.card.byId.getData({ cardPublicId });

      utils.card.byId.setData({ cardPublicId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          children: old.children.filter(
            (child) => child.publicId !== vars.cardPublicId,
          ),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous)
        utils.card.byId.setData({ cardPublicId }, ctx.previous);
      showPopup({
        header: t`Unable to remove sub-task`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
      await utils.board.byId.invalidate();
    },
  });

  const handleCreate = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    createSubtask.mutate({
      title: trimmed,
      description: "",
      listPublicId,
      labelPublicIds: [],
      memberPublicIds: [],
      position: "end",
      parentCardPublicId: cardPublicId,
    });
    setTitle("");
  };

  if (subtasks.length === 0 && (viewOnly || !isAdding)) {
    if (viewOnly) return null;
    return (
      <div className="pb-4">
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 rounded-md p-1 text-sm text-light-900 hover:bg-light-100 dark:text-dark-700 dark:hover:bg-dark-100"
        >
          <HiPlus size={16} />
          {t`Add sub-task`}
        </button>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-light-1000 dark:text-dark-1000">
          {t`Sub-tasks`}
          {subtasks.length > 0 && (
            <span className="ml-2 text-xs font-normal text-light-900 dark:text-dark-700">
              {subtasks.length}
            </span>
          )}
        </h3>
        {!viewOnly && (
          <button
            onClick={() => setIsAdding(true)}
            className="rounded-md p-1 text-light-900 hover:bg-light-100 dark:text-dark-700 dark:hover:bg-dark-100"
            aria-label={t`Add sub-task`}
          >
            <HiPlus size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {subtasks.map((subtask) => (
          <div
            key={subtask.publicId}
            className="group flex items-center gap-2 rounded-md border border-light-200 px-2 py-1.5 dark:border-dark-200"
          >
            <Link
              href={`/cards/${subtask.publicId}`}
              className="min-w-0 flex-1 truncate text-sm text-light-1000 hover:underline dark:text-dark-1000"
            >
              {cardPrefix && subtask.cardNumber != null && (
                <span className="mr-2 text-xs text-light-700 dark:text-dark-800">
                  {cardPrefix}-{subtask.cardNumber}
                </span>
              )}
              {subtask.title}
            </Link>
            <span className="flex-shrink-0 rounded-full border border-light-300 px-2 py-0.5 text-[10px] text-light-900 dark:border-dark-600 dark:text-dark-800">
              {subtask.list.name}
            </span>
            {!viewOnly && (
              <button
                onClick={() =>
                  detachSubtask.mutate({
                    cardPublicId: subtask.publicId,
                    parentCardPublicId: null,
                  })
                }
                className="invisible flex-shrink-0 rounded-md p-1 text-light-900 hover:bg-light-100 group-hover:visible dark:text-dark-700 dark:hover:bg-dark-100"
                aria-label={t`Remove sub-task`}
              >
                <HiXMark size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdding && !viewOnly && (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t`Sub-task title...`}
          className="mt-1 w-full rounded-md border border-light-300 bg-transparent px-2 py-1.5 text-sm text-light-1000 outline-none focus:border-light-500 dark:border-dark-500 dark:text-dark-1000 dark:focus:border-dark-700"
          onBlur={handleCreate}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setTitle("");
              setIsAdding(false);
            }
          }}
        />
      )}
    </div>
  );
}

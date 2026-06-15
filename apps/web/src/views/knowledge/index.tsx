import { t } from "@lingui/core/macro";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { HiOutlinePlusSmall, HiOutlineTrash, HiPencil } from "react-icons/hi2";

import Button from "~/components/Button";
import Input from "~/components/Input";
import { PageHead } from "~/components/PageHead";
import { usePopup } from "~/providers/popup";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";

type DraftState = {
  title: string;
  content: string;
  categoryPublicId: string | null;
};

const emptyDraft: DraftState = { title: "", content: "", categoryPublicId: null };

export default function KnowledgeView() {
  const { workspace } = useWorkspace();
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const workspacePublicId = workspace.publicId;
  const enabled = !!workspacePublicId && workspacePublicId.length >= 12;

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null,
  );
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const { data, isLoading } = api.knowledge.byWorkspace.useQuery(
    { workspacePublicId },
    { enabled },
  );

  const { data: article } = api.knowledge.articleByPublicId.useQuery(
    { articlePublicId: selectedArticleId ?? "" },
    { enabled: !!selectedArticleId && mode === "view" },
  );

  const invalidate = async () => {
    await utils.knowledge.byWorkspace.invalidate({ workspacePublicId });
    if (selectedArticleId)
      await utils.knowledge.articleByPublicId.invalidate({
        articlePublicId: selectedArticleId,
      });
  };

  const onError = (header: string) => () =>
    showPopup({
      header,
      message: t`Please try again later, or contact customer support.`,
      icon: "error",
    });

  const createCategory = api.knowledge.createCategory.useMutation({
    onSuccess: async () => {
      setNewCategoryName("");
      setIsAddingCategory(false);
      await invalidate();
    },
    onError: onError(t`Unable to create category`),
  });

  const deleteCategory = api.knowledge.deleteCategory.useMutation({
    onSuccess: invalidate,
    onError: onError(t`Unable to delete category`),
  });

  const createArticle = api.knowledge.createArticle.useMutation({
    onSuccess: async (created) => {
      setSelectedArticleId(created.publicId);
      setMode("view");
      await invalidate();
    },
    onError: onError(t`Unable to create article`),
  });

  const updateArticle = api.knowledge.updateArticle.useMutation({
    onSuccess: async () => {
      setMode("view");
      await invalidate();
    },
    onError: onError(t`Unable to update article`),
  });

  const deleteArticle = api.knowledge.deleteArticle.useMutation({
    onSuccess: async () => {
      setSelectedArticleId(null);
      setMode("view");
      await invalidate();
    },
    onError: onError(t`Unable to delete article`),
  });

  const categories = data?.categories ?? [];
  const articles = data?.articles ?? [];

  const startCreate = () => {
    setDraft({ ...emptyDraft, categoryPublicId: categories[0]?.publicId ?? null });
    setMode("create");
    setSelectedArticleId(null);
  };

  const startEdit = () => {
    if (!article) return;
    setDraft({
      title: article.title,
      content: article.content,
      categoryPublicId: article.category?.publicId ?? null,
    });
    setMode("edit");
  };

  const saveDraft = () => {
    if (!draft.title.trim()) return;
    if (mode === "create") {
      createArticle.mutate({
        workspacePublicId,
        title: draft.title.trim(),
        content: draft.content,
        categoryPublicId: draft.categoryPublicId,
      });
    } else if (mode === "edit" && selectedArticleId) {
      updateArticle.mutate({
        articlePublicId: selectedArticleId,
        title: draft.title.trim(),
        content: draft.content,
        categoryPublicId: draft.categoryPublicId,
      });
    }
  };

  // Group articles under their category (plus an "Uncategorized" bucket).
  const grouped = [
    ...categories.map((c) => ({
      key: c.publicId,
      name: c.name,
      deletable: true,
      items: articles.filter((a) => a.category?.publicId === c.publicId),
    })),
    {
      key: "__uncategorized__",
      name: t`Uncategorized`,
      deletable: false,
      items: articles.filter((a) => !a.category),
    },
  ].filter((group) => group.items.length > 0 || group.deletable);

  return (
    <>
      <PageHead title={t`Knowledge base`} />
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center justify-between border-b border-light-300 px-5 py-4 dark:border-dark-300">
          <h1 className="font-medium text-neutral-900 dark:text-dark-1000">
            {t`Knowledge base`}
          </h1>
          <Button
            iconLeft={<HiOutlinePlusSmall />}
            onClick={startCreate}
            disabled={!enabled}
          >
            {t`New article`}
          </Button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Left: categories + articles */}
          <div className="w-72 shrink-0 overflow-y-auto border-r border-light-300 p-3 dark:border-dark-300">
            {isLoading && (
              <div className="h-6 w-40 animate-pulse rounded bg-light-300 dark:bg-dark-300" />
            )}
            {!isLoading &&
              grouped.map((group) => (
                <div key={group.key} className="mb-4">
                  <div className="group mb-1 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-light-700 dark:text-dark-800">
                      {group.name}
                    </span>
                    {group.deletable && (
                      <button
                        onClick={() =>
                          deleteCategory.mutate({ categoryPublicId: group.key })
                        }
                        className="invisible rounded p-1 text-light-700 hover:bg-light-200 group-hover:visible dark:text-dark-800 dark:hover:bg-dark-200"
                        aria-label={t`Delete category`}
                      >
                        <HiOutlineTrash size={13} />
                      </button>
                    )}
                  </div>
                  {group.items.map((a) => (
                    <button
                      key={a.publicId}
                      onClick={() => {
                        setSelectedArticleId(a.publicId);
                        setMode("view");
                      }}
                      className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
                        selectedArticleId === a.publicId && mode === "view"
                          ? "bg-light-200 text-light-1000 dark:bg-dark-200 dark:text-dark-1000"
                          : "text-neutral-700 hover:bg-light-100 dark:text-dark-900 dark:hover:bg-dark-100"
                      }`}
                    >
                      {a.title}
                    </button>
                  ))}
                  {group.items.length === 0 && (
                    <p className="px-2 py-1 text-xs text-light-600 dark:text-dark-700">
                      {t`No articles`}
                    </p>
                  )}
                </div>
              ))}

            {isAddingCategory ? (
              <Input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t`Category name`}
                onBlur={() => {
                  if (newCategoryName.trim())
                    createCategory.mutate({
                      workspacePublicId,
                      name: newCategoryName.trim(),
                    });
                  else setIsAddingCategory(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCategoryName.trim())
                    createCategory.mutate({
                      workspacePublicId,
                      name: newCategoryName.trim(),
                    });
                  if (e.key === "Escape") setIsAddingCategory(false);
                }}
              />
            ) : (
              <button
                onClick={() => setIsAddingCategory(true)}
                disabled={!enabled}
                className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm text-light-700 hover:bg-light-100 dark:text-dark-800 dark:hover:bg-dark-100"
              >
                <HiOutlinePlusSmall size={16} />
                {t`New category`}
              </button>
            )}
          </div>

          {/* Right: article view / editor */}
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {mode === "view" && !article && (
              <p className="text-sm text-light-700 dark:text-dark-800">
                {t`Select an article, or create a new one.`}
              </p>
            )}

            {mode === "view" && article && (
              <article className="mx-auto max-w-3xl">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    {article.category && (
                      <span className="mb-1 inline-block rounded-full border border-light-300 px-2 py-0.5 text-[10px] text-light-700 dark:border-dark-600 dark:text-dark-800">
                        {article.category.name}
                      </span>
                    )}
                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-dark-1000">
                      {article.title}
                    </h2>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      iconLeft={<HiPencil />}
                      onClick={startEdit}
                    >
                      {t`Edit`}
                    </Button>
                    <Button
                      variant="secondary"
                      iconLeft={<HiOutlineTrash />}
                      onClick={() =>
                        deleteArticle.mutate({
                          articlePublicId: article.publicId,
                        })
                      }
                    >
                      {t`Delete`}
                    </Button>
                  </div>
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {article.content.trim() ? (
                    <ReactMarkdown>{article.content}</ReactMarkdown>
                  ) : (
                    <p className="text-sm italic text-light-600 dark:text-dark-700">
                      {t`This article is empty.`}
                    </p>
                  )}
                </div>
              </article>
            )}

            {(mode === "edit" || mode === "create") && (
              <div className="mx-auto max-w-3xl space-y-4">
                <Input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  placeholder={t`Article title`}
                />
                <select
                  value={draft.categoryPublicId ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      categoryPublicId: e.target.value || null,
                    }))
                  }
                  className="block w-full rounded-md border-0 bg-light-50 px-3 py-2 text-sm text-neutral-900 ring-1 ring-inset ring-light-600 focus:ring-2 focus:ring-inset focus:ring-light-600 dark:bg-dark-300 dark:text-dark-1000 dark:ring-dark-700"
                >
                  <option value="">{t`Uncategorized`}</option>
                  {categories.map((c) => (
                    <option key={c.publicId} value={c.publicId}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <textarea
                  value={draft.content}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, content: e.target.value }))
                  }
                  placeholder={t`Write your article in Markdown...`}
                  rows={18}
                  className="block w-full resize-y rounded-md border-0 bg-light-50 px-3 py-2 font-mono text-sm text-neutral-900 ring-1 ring-inset ring-light-600 focus:ring-2 focus:ring-inset focus:ring-light-600 dark:bg-dark-300 dark:text-dark-1000 dark:ring-dark-700"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMode(selectedArticleId ? "view" : "view");
                      setDraft(emptyDraft);
                    }}
                  >
                    {t`Cancel`}
                  </Button>
                  <Button
                    onClick={saveDraft}
                    disabled={!draft.title.trim()}
                    isLoading={
                      createArticle.isPending || updateArticle.isPending
                    }
                  >
                    {mode === "create" ? t`Create` : t`Save`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

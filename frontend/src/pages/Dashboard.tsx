import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/api/client";
import useServerErrors from '@/hooks/useServerErrors';
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CreatePageDialog = lazy(() => import("@/components/CreatePageDialog"));

const DeleteConfirmDialog = lazy(
  () => import("@/components/DeleteConfirmDialog"),
);
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ListTodo } from "lucide-react";

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["pages"],
    queryFn: () => apiClient.getPages(),
  });

  const createPageMutation = useMutation({
    mutationFn: (data: { title: string; description?: string }) =>
      apiClient.createPage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setIsCreateOpen(false);
      setNewPageTitle("");
      setNewPageDesc("");
    },
    onError: () => {
      toast.error(t("dashboard.create_error"));
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: string) => apiClient.deletePage(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setPageToDelete(null);
    },
    onError: () => {
      toast.error(t("dashboard.delete_error"));
    },
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageDesc, setNewPageDesc] = useState("");
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);
  const serverErrors = useServerErrors();
  const { errors: createErrors, setFromError: setCreateErrorsFromError, clear: clearCreateErrors, onChangeClear: onChangeClearCreate } = serverErrors;

  const handleCreatePage = () => {
    if (!newPageTitle.trim()) return;
    clearCreateErrors();
    createPageMutation.mutate({
      title: newPageTitle.trim(),
      description: newPageDesc.trim() || undefined,
    }, {
        onError: (err: unknown) => {
        if (err instanceof Error) {
          // backend may attach a `validation` payload to errors
          const maybe = err as unknown as { validation?: unknown };
          if (maybe.validation) {
            setCreateErrorsFromError(maybe.validation);
            return;
          }
        }
        toast.error(t("dashboard.create_error"));
      }
    });
  };

  const handleDeletePage = () => {
    if (!pageToDelete) return;
    deletePageMutation.mutate(pageToDelete);
  };

  const createdPages = pages.filter((p) => p.is_creator);
  const sharedPages = pages.filter((p) => !p.is_creator);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 h-14 border-b border-border bg-background">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <ListTodo className="size-5 text-accent" />
            <span className="text-[15px] font-semibold">{t("dashboard.title")}</span>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* My Pages */}
            {createdPages.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">
                      {t("dashboard.my_pages", { count: createdPages.length })}
                    </h2>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    <Plus className="size-4" />
                    {t("dashboard.create_page")}
                  </Button>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                  {createdPages.map((page) => (
                    <div
                      key={page.id}
                      className="group relative cursor-pointer rounded-lg border border-border bg-surface p-4 transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm"
                      onClick={() => navigate(`/pages/${page.id}`)}
                    >
                      <div className="flex flex-col gap-2">
                        <p className="truncate text-[15px] font-medium">
                          {page.title}
                        </p>
                        <p className="line-clamp-2 min-h-[36px] text-[13px] text-secondary-foreground">
                          {page.description || t("dashboard.no_description")}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(page.created_at).toLocaleDateString(
                              i18n.language,
                            )}
                          </span>
                          <Button
                            variant="ghost-destructive"
                            size="icon-dense"
                            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                            aria-label={t("common.delete")}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPageToDelete(page.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Shared Pages */}
            {sharedPages.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">
                      {t("dashboard.shared_with_me", { count: sharedPages.length })}
                    </h2>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                  {sharedPages.map((page) => (
                    <div
                      key={page.id}
                      className="group relative cursor-pointer rounded-lg border border-border bg-surface p-4 transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm"
                      onClick={() => navigate(`/pages/${page.id}`)}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[15px] font-medium">
                            {page.title}
                          </p>
                          {page.can_edit ? (
                            <Badge variant="editor">{t("dashboard.role_editor")}</Badge>
                          ) : (
                            <Badge variant="viewer">{t("dashboard.role_viewer")}</Badge>
                          )}
                        </div>
                        <p className="line-clamp-2 min-h-[36px] text-[13px] text-secondary-foreground">
                          {page.description || t("dashboard.no_description")}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(page.created_at).toLocaleDateString(
                              i18n.language,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {createdPages.length === 0 && sharedPages.length === 0 && (
              <div className="rounded-lg border border-dashed border-border-strong py-10">
                <div className="flex flex-col items-center">
                  <ListTodo className="size-8 text-muted-foreground" />
                  <p className="mt-4 text-sm font-medium">{t("dashboard.no_pages")}</p>
                  <p className="mt-1 max-w-sm text-center text-[13px] text-secondary-foreground">
                    {t("dashboard.no_pages_description")}
                  </p>
                  <Button
                    className="mt-4 gap-2"
                    variant="primary"
                    size="md"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    <Plus className="size-4" />
                    {t("dashboard.create_page")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {pageToDelete && (
        <Suspense fallback={<div />}>
          <DeleteConfirmDialog
            open={!!pageToDelete}
            onOpenChange={(open) => !open && setPageToDelete(null)}
            onConfirm={handleDeletePage}
            title={t("dashboard.delete_confirm_title")}
            description={t("dashboard.delete_confirm_description")}
            confirmText={t("common.delete")}
            cancelText={t("common.cancel")}
          />
        </Suspense>
      )}

      <Suspense fallback={<div />}>
        <CreatePageDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          newPageTitle={newPageTitle}
          setNewPageTitle={setNewPageTitle}
          newPageDesc={newPageDesc}
          setNewPageDesc={setNewPageDesc}
          onCreate={handleCreatePage}
          isPending={createPageMutation.isPending}
          errors={createErrors}
          onChangeClear={onChangeClearCreate}
          applyToForm={serverErrors.applyToForm}
          cancelText={t("common.cancel")}
          submitText={t("common.add")}
        />
      </Suspense>
    </div>
  );
}

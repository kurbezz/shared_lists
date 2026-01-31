import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { List, PageWithPermission, UpdateList } from '@/types';
import { apiClient } from '@/api/client';
import useServerErrors from '@/hooks/useServerErrors';
import { ListCard } from '@/components/ListCard';
import { ShareDialog } from '@/components/ShareDialog';
import { UserMenu } from '@/components/UserMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ChevronLeft, Trash2, Plus, Loader2, Check, ListTodo } from 'lucide-react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function PageView() {
  const { t } = useTranslation();
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newListTitle, setNewListTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editPageTitle, setEditPageTitle] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editPageDesc, setEditPageDesc] = useState('');
  const pageServerErrors = useServerErrors();
  const { errors: pageErrors, setFrom: setPageErrorsFrom, clear: clearPageErrors, onChangeClear: onChangeClearPage } = pageServerErrors;

  // Queries
  const { data: page, error: pageError } = useQuery({
    queryKey: ['page', pageId],
    queryFn: () => apiClient.getPage(pageId!),
    enabled: !!pageId,
  });

  const { data: lists = [], isLoading: isListsLoading } = useQuery({
    queryKey: ['lists', pageId],
    queryFn: () => apiClient.getLists(pageId!),
    enabled: !!pageId,
    select: (data) => [...data].sort((a, b) => a.position - b.position),
  });

  useEffect(() => {
    if (page) {
      setEditPageTitle(page.title);
      setEditPageDesc(page.description || '');
    }
  }, [page]);

  useEffect(() => {
    if (pageError) {
      console.error('Failed to load page:', pageError);
      toast.error(t('page.load_error'));
      navigate('/');
    }
  }, [pageError, navigate, t]);

  // Watch global pages list
  const { data: pages = [], isFetched: pagesFetched } = useQuery<PageWithPermission[]>({
    queryKey: ['pages'],
    queryFn: () => apiClient.getPages(),
  });

  useEffect(() => {
    if (!pagesFetched) return;
    if (pageId && pages && !pages.find((p) => p.id === pageId)) {
      navigate('/');
    }
  }, [pagesFetched, pages, pageId, navigate]);

  // Mutations
  const addListMutation = useMutation({
    mutationFn: (title: string) => apiClient.createList(pageId!, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists', pageId] });
      setNewListTitle('');
    },
    onError: () => {
      toast.error(t('page.create_list_error'));
    },
  });

  const updateListMutation = useMutation({
    mutationFn: ({ listId, data }: { listId: string; data: Partial<UpdateList> }) =>
      apiClient.updateList(pageId!, listId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists', pageId] });
    },
    onError: () => {
      toast.error(t('page.update_list_error'));
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (listId: string) => apiClient.deleteList(pageId!, listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists', pageId] });
    },
    onError: () => {
      toast.error(t('page.delete_list_error'));
    },
  });

  const updatePageMutation = useMutation({
    mutationFn: (data: { title?: string; description?: string }) => apiClient.updatePage(pageId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page', pageId] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      setIsEditingTitle(false);
      setIsEditingDesc(false);
      clearPageErrors();
    },
    onError: (err: unknown) => {
      if (err instanceof Error) {
        const maybe = err as unknown as { validation?: unknown };
        if (maybe.validation) {
          setPageErrorsFrom(maybe.validation);
          return;
        }
      }
      toast.error(t('page.update_title_error'));
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: () => apiClient.deletePage(pageId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: () => {
      toast.error(t('dashboard.delete_error'));
    },
  });

  const updateListPositionsMutation = useMutation({
    mutationFn: (updates: { listId: string; position: number }[]) =>
      Promise.all(updates.map((u) => apiClient.updateList(pageId!, u.listId, { position: u.position }))),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['lists', pageId] });
      const previous = queryClient.getQueryData<List[]>(['lists', pageId]);

      queryClient.setQueryData(['lists', pageId], (old?: List[]) => {
        if (!old) return old;
        const mutated = old.map((l) => ({ ...l }));
        updates.forEach((u) => {
          const idx = mutated.findIndex((x) => x.id === u.listId);
          if (idx !== -1) mutated[idx] = { ...mutated[idx], position: u.position };
        });
        return mutated.slice().sort((a, b) => a.position - b.position);
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['lists', pageId], context.previous);
      }
      toast.error(t('page.update_list_error'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lists', pageId] });
    },
  });

  const handleAddList = () => {
    if (!pageId || !newListTitle.trim()) return;
    addListMutation.mutate(newListTitle.trim());
  };

  const handleUpdateList = async (listId: string, data: Partial<UpdateList>) => {
    if (!pageId) return;
    updateListMutation.mutate({ listId, data });
  };

  const handleDeleteList = async (listId: string) => {
    if (!pageId) return;
    deleteListMutation.mutate(listId);
  };

  const handleListsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = lists.findIndex((l) => l.id === active.id);
    const newIndex = lists.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(lists, oldIndex, newIndex).map((l, idx) => ({ ...l, position: idx }));

    const changed = newOrder
      .map((l, idx) => ({
        listId: l.id,
        position: idx,
        prev: lists.find((x) => x.id === l.id)?.position,
      }))
      .filter((x) => x.prev !== x.position)
      .map((x) => ({ listId: x.listId, position: x.position }));

    if (changed.length === 0) return;

    updateListPositionsMutation.mutate(changed);
  };

  const SortableListItem = ({ list }: { list: List }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: list.id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <ListCard
          list={list}
          canEdit={page!.can_edit}
          onUpdate={handleUpdateList}
          onDelete={handleDeleteList}
          dragHandleProps={listeners}
          onClearField={onChangeClearPage}
        />
      </div>
    );
  };

  const handleUpdatePageTitle = () => {
    if (!pageId || !editPageTitle.trim() || editPageTitle === page?.title) {
      setIsEditingTitle(false);
      return;
    }
    clearPageErrors();
    updatePageMutation.mutate({ title: editPageTitle.trim() });
  };

  const handleUpdatePageDescription = () => {
    if (!pageId || editPageDesc === (page?.description || '')) {
      setIsEditingDesc(false);
      return;
    }
    clearPageErrors();
    updatePageMutation.mutate({ description: editPageDesc.trim() || undefined });
  };

  const handleDeletePage = () => {
    if (!pageId) return;
    deletePageMutation.mutate();
  };

  const handleBack = () => {
    try {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    } catch {
      navigate('/');
    }
  };

  const handleKeyDownNewList = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddList();
    }
  };

  const handleKeyDownTitle = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUpdatePageTitle();
    } else if (e.key === 'Escape') {
      setEditPageTitle(page?.title || '');
      setIsEditingTitle(false);
    }
  };

  const handleKeyDownDesc = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUpdatePageDescription();
    } else if (e.key === 'Escape') {
      setEditPageDesc(page?.description || '');
      setIsEditingDesc(false);
    }
  };

  if (!page) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  title={t('page.back_to_pages')}
                  className="shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
                    <ListTodo className="w-5 h-5 text-white" />
                  </div>

                  {isEditingTitle ? (
                    <div className="flex items-center gap-2 flex-1 max-w-lg">
                       <Input
                         value={editPageTitle}
                         onChange={(e) => {
                          setEditPageTitle(e.target.value);
                            if (onChangeClearPage) onChangeClearPage('title')(e);
                         }}
                         onKeyDown={handleKeyDownTitle}
                         onBlur={handleUpdatePageTitle}
                         autoFocus
                         className="text-xl font-bold h-10"
                       />
                       {pageErrors['title'] && <p className="text-sm text-destructive mt-1">{pageErrors['title']}</p>}

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10"
                        onClick={handleUpdatePageTitle}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <h1
                      className="text-xl sm:text-2xl font-bold cursor-pointer hover:text-violet-600 transition-colors truncate max-w-md"
                      onDoubleClick={() => page.can_edit && setIsEditingTitle(true)}
                      title={page.can_edit ? t('page.edit_title_hint') : page.title}
                    >
                      {page.title}
                    </h1>
                  )}
                </div>
              </div>

              <div className="pl-[52px] sm:pl-[76px]">
                {isEditingDesc ? (
                  <div className="flex items-start gap-2 max-w-lg">
                      <Textarea
                       value={editPageDesc}
                       onChange={(e) => { setEditPageDesc(e.target.value); if (onChangeClearPage) onChangeClearPage('description')(e); }}
                      onKeyDown={handleKeyDownDesc}
                      onBlur={handleUpdatePageDescription}
                      autoFocus
                      rows={2}
                      placeholder={t('page.add_desc_placeholder')}
                      className="min-h-[60px]"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={handleUpdatePageDescription}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p
                    className="text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors max-w-2xl text-sm"
                    onDoubleClick={() => page.can_edit && setIsEditingDesc(true)}
                    title={page.can_edit ? t('page.edit_desc_hint') : ''}
                  >
                    {page.description || (
                      page.can_edit ? (
                        <span className="italic opacity-50">{t('page.add_desc_placeholder')}</span>
                      ) : null
                    )}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-2">
                  {page.is_creator ? (
                    <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-100">
                      {t('page.role_creator')}
                    </Badge>
                  ) : page.can_edit ? (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                      {t('page.role_editor')}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{t('page.role_viewer')}</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {page.is_creator && (
                <>
                  <ShareDialog page={page} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-2">
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('page.delete_page')}</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('dashboard.delete_confirm_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('dashboard.delete_confirm_description')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeletePage}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t('common.delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Lists */}
      <main className="flex-1 overflow-hidden min-h-0">
        <div className="h-full overflow-x-auto overflow-y-auto p-4 sm:p-6">
          <DndContext onDragEnd={handleListsDragEnd} collisionDetection={closestCenter}>
            <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start pb-4">
                {isListsLoading ? (
                  <div className="flex gap-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-full lg:w-[320px] h-[200px] bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  lists.map((list) => <SortableListItem key={list.id} list={list} />)
                )}

                {/* Add List Card */}
                {page.can_edit && (
                  <Card className="w-full lg:w-[320px] lg:flex-shrink-0 bg-slate-50/50 dark:bg-slate-800/30 border-dashed border-2 border-slate-200 dark:border-slate-700 shadow-none hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-base mb-3 text-slate-700 dark:text-slate-300">
                        {t('page.new_list')}
                      </h3>
                      <div className="flex gap-2">
                        <Input
                          value={newListTitle}
                          onChange={(e) => setNewListTitle(e.target.value)}
                          onKeyDown={handleKeyDownNewList}
                          placeholder={t('page.new_list_placeholder')}
                          disabled={addListMutation.isPending}
                          className="bg-white dark:bg-slate-800"
                        />
                        <Button
                          size="icon"
                          onClick={handleAddList}
                          disabled={addListMutation.isPending || !newListTitle.trim()}
                          className="shrink-0 bg-violet-500 hover:bg-violet-600"
                        >
                          {addListMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </main>
    </div>
  );
}

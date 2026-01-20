import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { List, UpdateList, UpdateListItem, ListItem as ListItemType } from '@/types';
import { apiClient } from '@/api/client';
import { ListItem } from './ListItem';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, X, Loader2, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ListCardProps {
  list: List;
  canEdit: boolean;
  onUpdate: (listId: string, data: Partial<UpdateList>) => Promise<void>;
  onDelete: (listId: string) => Promise<void>;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function ListCard({ list, canEdit, onUpdate, onDelete, dragHandleProps }: ListCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(list.title);
  const [showCheckBoxes, setShowCheckBoxes] = useState(list.show_checkboxes);
  const [showProgress, setShowProgress] = useState(list.show_progress);
  const [newItemContent, setNewItemContent] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    setEditTitle(list.title);
    setShowCheckBoxes(list.show_checkboxes);
    setShowProgress(list.show_progress);
  }, [list]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['list-items', list.id],
    queryFn: () => apiClient.getListItems(list.id),
    select: (data) => [...data].sort((a, b) => a.position - b.position),
  });

  const addItemMutation = useMutation({
    mutationFn: (content: string) => apiClient.createListItem(list.id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', list.id] });
      setNewItemContent('');
    },
    onError: () => {
      toast.error(t('list.create_error'));
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateListItem }) =>
      apiClient.updateListItem(list.id, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', list.id] });
    },
    onError: () => {
      toast.error(t('list.update_error'));
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => apiClient.deleteListItem(list.id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', list.id] });
    },
    onError: () => {
      toast.error(t('list.delete_error'));
    },
  });

  const updateItemsPositionsMutation = useMutation({
    mutationFn: (updates: { itemId: string; position: number }[]) =>
      Promise.all(updates.map((u) => apiClient.updateListItem(list.id, u.itemId, { position: u.position }))),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['list-items', list.id] });
      const previous = queryClient.getQueryData<ListItemType[]>(['list-items', list.id]);

      queryClient.setQueryData<ListItemType[]>(['list-items', list.id], (old) => {
        if (!old) return old;
        const mutated = old.map((it) => ({ ...it }));
        updates.forEach((u) => {
          const idx = mutated.findIndex((x) => x.id === u.itemId);
          if (idx !== -1) mutated[idx] = { ...mutated[idx], position: u.position };
        });
        return mutated.slice().sort((a, b) => a.position - b.position);
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['list-items', list.id], context.previous);
      }
      toast.error(t('list.update_error'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', list.id] });
    },
  });

  const handleUpdateTitle = async () => {
    const titleChanged = editTitle.trim() && editTitle !== list.title;
    const checkboxesChanged = showCheckBoxes !== list.show_checkboxes;
    const progressChanged = showProgress !== list.show_progress;

    if (titleChanged || checkboxesChanged || progressChanged) {
      const payload: Partial<UpdateList> = {};
      if (titleChanged) payload.title = editTitle.trim();
      if (checkboxesChanged) payload.show_checkboxes = showCheckBoxes;
      if (progressChanged) payload.show_progress = showProgress;

      await onUpdate(list.id, payload);
    }

    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(list.title);
    setShowCheckBoxes(list.show_checkboxes);
    setShowProgress(list.show_progress);
    setIsEditing(false);
  };

  const handleAddItem = () => {
    if (!newItemContent.trim()) return;
    addItemMutation.mutate(newItemContent.trim());
  };

  const handleUpdateItem = async (itemId: string, data: UpdateListItem) => {
    updateItemMutation.mutate({ itemId, data });
  };

  const handleDeleteItem = async (itemId: string) => {
    deleteItemMutation.mutate(itemId);
  };

  const handleItemsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(items, oldIndex, newIndex).map((it, idx) => ({ ...it, position: idx }));

    const changed = newOrder
      .map((it, idx) => ({
        itemId: it.id,
        position: idx,
        prev: items.find((x) => x.id === it.id)?.position,
      }))
      .filter((x) => x.prev !== x.position)
      .map((x) => ({ itemId: x.itemId, position: x.position }));

    if (changed.length === 0) return;

    updateItemsPositionsMutation.mutate(changed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUpdateTitle();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const SortableItem = ({ item }: { item: ListItemType }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <ListItem
          item={item}
          canEdit={canEdit}
          onUpdate={handleUpdateItem}
          onDelete={handleDeleteItem}
          dragHandleProps={listeners}
        />
      </div>
    );
  };

  return (
    <>
      <Card className="w-full lg:w-[320px] lg:flex-shrink-0 flex flex-col max-h-[70vh] min-h-[200px] bg-white dark:bg-slate-800 shadow-md border-t-4 border-t-violet-500 rounded-xl overflow-hidden">
        <CardHeader className="p-4 pb-3 space-y-0 relative group bg-slate-50 dark:bg-slate-800/50">
          {canEdit && dragHandleProps && (
            <div
              {...dragHandleProps}
              className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <GripVertical className="w-5 h-5" />
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-1 items-center">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={handleUpdateTitle}
                  autoFocus
                  className="h-9 font-semibold text-base"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={handleUpdateTitle}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  onClick={handleCancelEdit}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-col gap-2 text-sm">
                <label
                  className="flex items-center gap-2 cursor-pointer"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Checkbox
                    checked={showCheckBoxes}
                    onCheckedChange={(v) => setShowCheckBoxes(!!v)}
                    className="data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('list.show_checkboxes_on_public')}
                  </span>
                </label>
                <label
                  className="flex items-center gap-2 cursor-pointer"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Checkbox
                    checked={showProgress}
                    onCheckedChange={(v) => setShowProgress(!!v)}
                    className="data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('list.show_progress_on_public')}
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h3
                className="font-semibold text-base truncate cursor-pointer py-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex-1 mr-2 text-slate-900 dark:text-white"
                onDoubleClick={() => canEdit && setIsEditing(true)}
                title={list.title}
              >
                {list.title}
              </h3>
              {canEdit && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-violet-600"
                    onClick={() => setIsEditing(true)}
                    title={t('list.edit_title_hint')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-destructive"
                    onClick={() => setIsDeleteOpen(true)}
                    title={t('list.delete_list_hint')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-3 min-h-[60px] space-y-1">
          {isLoading ? (
            <div className="space-y-2 p-2">
              <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm italic">
              {t('list.empty')}
            </div>
          ) : (
            <DndContext onDragEnd={handleItemsDragEnd} collisionDetection={closestCenter}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {items.map((item) => (
                    <SortableItem key={item.id} item={item} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>

        {canEdit && (
          <CardFooter className="p-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="flex gap-2 w-full">
              <Input
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('list.add_item_placeholder')}
                disabled={addItemMutation.isPending}
                className="h-9"
              />
              <Button
                size="icon"
                onClick={handleAddItem}
                disabled={addItemMutation.isPending || !newItemContent.trim()}
                className="h-9 w-9 shrink-0 bg-violet-500 hover:bg-violet-600"
              >
                {addItemMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('list.delete_confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setIsDeleteOpen(false);
                await onDelete(list.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
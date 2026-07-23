import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { List, UpdateList, UpdateListItem, ListItem as ListItemType } from '@/types';
import { apiClient } from '@/api/client';
import { parseValidationErrors, getValidationFromError } from '@/lib/validation';
import useServerErrors from '@/hooks/useServerErrors';
import { ListItem } from './ListItem';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Plus, GripVertical, Settings } from 'lucide-react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface ListCardProps {
  list: List;
  canEdit: boolean;
  onUpdate: (listId: string, data: Partial<UpdateList>) => Promise<void>;
  onDelete: (listId: string) => Promise<void>;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  /** optional validation error for this list (e.g. { title: '...' }) */
  error?: string | null;
  /** optional helper from parent to clear a server error for a field when input changes */
  onClearField?: (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

export function ListCard({ list, canEdit, onUpdate, onDelete, dragHandleProps, error, onClearField }: ListCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(list.title);
  const [showCheckBoxes, setShowCheckBoxes] = useState(list.show_checkboxes);
  const [showProgress, setShowProgress] = useState(list.show_progress);
  const [newItemContent, setNewItemContent] = useState('');
  const addItemServerErrors = useServerErrors();
  const { errors: addItemErrors, setFrom: setAddItemErrorsFrom, clear: clearAddItemErrors, onChangeClear: onChangeClearAddItem } = addItemServerErrors;
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    setEditTitle(list.title);
    setShowCheckBoxes(list.show_checkboxes);
    setShowProgress(list.show_progress);
  }, [list]);

  // apply server errors produced for add-item into the local input if present
  useEffect(() => {
    // If addItemErrors contains a 'content' message, keep it displayed via local state
    if (addItemErrors && addItemErrors['content']) {
      // no-op for now; the UI uses addItemErrors['content'] directly
    }
  }, [addItemErrors]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['list-items', list.id],
    queryFn: () => apiClient.getListItems(list.id),
    select: (data) => [...data].sort((a, b) => a.position - b.position),
  });

  const totalCount = items.length;
  const completedCount = items.filter((i) => i.checked).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const addItemMutation = useMutation({
    mutationFn: (content: string) => apiClient.createListItem(list.id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', list.id] });
      setNewItemContent('');
      clearAddItemErrors();
    },
    onError: (err: unknown) => {
      const v = getValidationFromError(err) ?? err;
      // If validation info exists, set it
      const parsedAdd = parseValidationErrors(v);
      if (Object.keys(parsedAdd).length > 0) {
        setAddItemErrorsFrom(v);
        return;
      }
      toast.error(t('list.create_error'));
    },
  });

  const updateItemMutation = useMutation<ListItemType, unknown, { itemId: string; data: UpdateListItem }>({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateListItem }) =>
      apiClient.updateListItem(list.id, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', list.id] });
    },
    onError: (_err: unknown, vars: { itemId: string; data: UpdateListItem } | undefined) => {
      // If validation errors are returned, map them to the specific item
      // so the UI can display per-item messages.
      const v = getValidationFromError(_err) ?? _err;
      if (vars) {
        const parsed = parseValidationErrors(v);
        if (parsed['content']) {
          setUpdateItemErrors((s) => ({ ...s, [vars.itemId]: parsed['content'] }));
          return;
        }
      }
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

  const [updateItemErrors, setUpdateItemErrors] = useState<Record<string,string>>({});

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

  const handleToggleShowCheckBoxes = async (value: boolean) => {
    setShowCheckBoxes(value);
    await onUpdate(list.id, { show_checkboxes: value });
  };

  const handleToggleShowProgress = async (value: boolean) => {
    setShowProgress(value);
    await onUpdate(list.id, { show_progress: value });
  };

  const handleAddItem = () => {
    if (!newItemContent.trim()) return;
    clearAddItemErrors();
    addItemMutation.mutate(newItemContent.trim());
  };

  const handleUpdateItem = async (itemId: string, data: UpdateListItem) => {
    // Clear any prior error for this item
    setUpdateItemErrors((s) => {
      const copy = { ...s };
      delete copy[itemId];
      return copy;
    });
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
          showCheckbox={showCheckBoxes}
          onUpdate={handleUpdateItem}
          onDelete={handleDeleteItem}
          dragHandleProps={listeners}
          error={updateItemErrors[item.id]}
        />
      </div>
    );
  };

  return (
    <>
      <Card className="group flex w-[320px] shrink-0 flex-col max-h-[calc(100vh-180px)]">
        <div className="flex items-center gap-1.5 border-b border-border px-2 py-2">
          {isEditing ? (
            <div className="flex flex-1 flex-col">
              <Input
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  if (onClearField) onClearField('title')(e);
                }}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleUpdateTitle}
                autoFocus
                className="h-7 flex-1 text-sm font-medium"
              />
              {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
            </div>
          ) : (
            <>
              {canEdit && dragHandleProps && (
                <div
                  {...dragHandleProps}
                  aria-roledescription="sortable"
                  className={cn(
                    "cursor-grab text-muted-foreground opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
                    dragHandleProps.className
                  )}
                >
                  <GripVertical className="size-3.5" />
                </div>
              )}

              <h3
                className="flex-1 truncate px-1 text-sm font-medium"
                onDoubleClick={() => canEdit && setIsEditing(true)}
                title={list.title}
              >
                {list.title}
              </h3>

              <Badge variant="counter">
                {showProgress && totalCount > 0 ? `${completedCount}/${totalCount}` : totalCount}
              </Badge>

              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-dense" aria-label={t('common.edit')}>
                      <Settings className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuCheckboxItem
                      checked={showCheckBoxes}
                      onCheckedChange={(v) => handleToggleShowCheckBoxes(!!v)}
                    >
                      {t('list.show_checkboxes_on_public')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={showProgress}
                      onCheckedChange={(v) => handleToggleShowProgress(!!v)}
                    >
                      {t('list.show_progress_on_public')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      {t('list.edit_title_hint')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteOpen(true)}>
                      {t('list.delete_list_hint')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>

        {showProgress && !isLoading && totalCount > 0 && (
          <div className="border-b border-border px-3 py-2">
            <div
              className="h-1.5 w-full rounded-full bg-subtle"
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-label={t('list.show_progress_on_public')}
            >
              <div
                className="h-full rounded-full bg-accent-solid transition-[width] duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {isLoading ? (
            <div className="space-y-0.5 p-1.5">
              <div className="h-9 rounded bg-subtle animate-pulse" />
              <div className="h-9 rounded bg-subtle animate-pulse" />
              <div className="h-9 rounded bg-subtle animate-pulse" />
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-muted-foreground">
              {t('list.empty')}
            </div>
          ) : (
            <DndContext onDragEnd={handleItemsDragEnd} collisionDetection={closestCenter}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <SortableItem key={item.id} item={item} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {canEdit && (
          <div className="border-t border-border p-1.5">
            <div className="flex items-center gap-2">
              <Plus className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-1 flex-col">
                <Input
                  value={newItemContent}
                  onChange={(e) => {
                    setNewItemContent(e.target.value);
                    if (onChangeClearAddItem) onChangeClearAddItem('content')(e);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('list.add_item_placeholder')}
                  disabled={addItemMutation.isPending}
                  className="h-8 border-transparent text-sm hover:border-border focus:border-accent"
                />
                {addItemErrors['content'] && (
                  <p className="mt-1 text-xs text-destructive">{addItemErrors['content']}</p>
                )}
              </div>
            </div>
          </div>
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
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { List, UpdateListItem } from '../types';
import { apiClient } from '../api/client';
import { ListItemComponent } from './ListItemComponent';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface ListComponentProps {
  list: List;
  canEdit: boolean;
  onUpdate: (listId: string, title: string) => Promise<void>;
  onDelete: (listId: string) => Promise<void>;
}

export const ListComponent: React.FC<ListComponentProps> = ({
  list,
  canEdit,
  onUpdate,
  onDelete,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(list.title);
  const [newItemContent, setNewItemContent] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Queries
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['list-items', list.id],
    queryFn: () => apiClient.getListItems(list.id),
  });

  // Mutations
  const addItemMutation = useMutation({
    mutationFn: (content: string) => apiClient.createListItem(list.id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', list.id] });
      setNewItemContent('');
    },
    onError: (error) => {
      console.error('Failed to create item:', error);
      notify(t('list.create_error'));
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateListItem }) =>
      apiClient.updateListItem(list.id, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', list.id] });
    },
    onError: (error) => {
      console.error('Failed to update item:', error);
      notify(t('list.update_error'));
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => apiClient.deleteListItem(list.id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', list.id] });
    },
    onError: (error) => {
      console.error('Failed to delete item:', error);
      notify(t('list.delete_error'));
    },
  });

  const handleUpdateTitle = async () => {
    if (editTitle.trim() && editTitle !== list.title) {
      await onUpdate(list.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(list.title);
    setIsEditing(false);
  };

  const handleAddItem = async () => {
    if (!newItemContent.trim()) return;
    addItemMutation.mutate(newItemContent.trim());
  };

  const handleUpdateItem = async (itemId: string, data: UpdateListItem) => {
    updateItemMutation.mutate({ itemId, data });
  };

  const handleDeleteItem = async (itemId: string) => {
    deleteItemMutation.mutate(itemId);
  };

  const handleDeleteList = async () => {
    setIsDeleteOpen(true);
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
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <Card className="w-[300px] flex-shrink-0 flex flex-col max-h-full shadow-md border-t-4 border-t-primary">
      {/* List Header */}
      <CardHeader className="p-3 pb-2 space-y-0 relative group">
        {isEditing ? (
          <div className="flex gap-1 items-center">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleUpdateTitle}
              autoFocus
              className="h-8 font-semibold text-lg px-2"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleUpdateTitle} onMouseDown={(e) => e.preventDefault()}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="destructive" className="h-8 w-8" onClick={handleCancelEdit} onMouseDown={(e) => e.preventDefault()}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h3
              className="font-semibold text-lg truncate cursor-pointer py-1 px-2 hover:bg-muted/50 rounded flex-1 mr-2"
              onDoubleClick={() => canEdit && setIsEditing(true)}
              title={list.title}
              data-cy="list-title"
            >
              {list.title}
            </h3>
            {canEdit && (
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-3 bg-card shadow-sm border rounded p-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setIsEditing(true)}
                  title={t('list.edit_title_hint')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-7 w-7"
                  onClick={handleDeleteList}
                  title={t('list.delete_list_hint')}
                  data-cy="delete-list-btn"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-2 min-h-[50px] space-y-1 custom-scrollbar">
        {isLoading ? (
          <div className="space-y-2 p-2">
            <div className="h-8 bg-muted rounded animate-pulse" />
            <div className="h-8 bg-muted rounded animate-pulse" />
            <div className="h-8 bg-muted rounded animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm italic">
            {t('list.empty')}
          </div>
        ) : (
          items.map((item) => (
            <ListItemComponent
              key={item.id}
              item={item}
              canEdit={canEdit}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
            />
          ))
        )}
      </CardContent>

      {/* Add Item */}
      {canEdit && (
        <CardFooter className="p-3 pt-2">
          <div className="flex gap-2 w-full">
            <Input
              value={newItemContent}
              onChange={(e) => setNewItemContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('list.add_item_placeholder')}
              disabled={addItemMutation.isPending}
              className="h-9"
              data-cy="create-item-input"
            />
            <Button
              size="icon"
              onClick={handleAddItem}
              disabled={addItemMutation.isPending || !newItemContent.trim()}
              className="h-9 w-9 flex-shrink-0"
              data-cy="create-item-btn"
            >
              {addItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </CardFooter>
      )}

      <AlertDialog open={isDeleteOpen} onOpenChange={(open) => !open && setIsDeleteOpen(false)}>
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
                try {
                  await onDelete(list.id);
                } catch (error) {
                  console.error('Failed to delete list:', error);
                  notify(t('list.delete_error'));
                }
              }}
              data-cy="confirm-delete-list-btn"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
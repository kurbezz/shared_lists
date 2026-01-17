import React, { useState } from 'react';
import type { ListItem, UpdateListItem } from '../types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface ListItemComponentProps {
  item: ListItem;
  canEdit: boolean;
  onUpdate: (itemId: string, data: UpdateListItem) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}

export const ListItemComponent: React.FC<ListItemComponentProps> = ({
  item,
  canEdit,
  onUpdate,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleCheckToggle = async (checked: boolean) => {
    if (!canEdit) return;
    await onUpdate(item.id, { checked });
  };

  const handleSave = async () => {
    if (editContent.trim() && editContent !== item.content) {
      await onUpdate(item.id, { content: editContent.trim() });
    }
    setIsEditing(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleCancel = () => {
    setEditContent(item.content);
    setIsEditing(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleDelete = async () => {
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleteOpen(false);
    setIsDeleting(true);
    try {
      await onDelete(item.id);
    } catch (error) {
      setIsDeleting(false);
      console.error('Failed to delete item:', error);
      notify(t('list.delete_error'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isDeleting) {
    return (
      <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20 animate-pulse">
        <span className="text-destructive text-sm">{t('common.deleting')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-card hover:bg-accent/50 rounded-lg group transition-all duration-200 border border-transparent hover:border-border">
      {canEdit ? (
        <Checkbox
          checked={item.checked}
          onCheckedChange={handleCheckToggle}
          className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          data-cy="item-checkbox"
        />
      ) : item.checked && (
        <Check className="w-4 h-4 text-green-500" />
      )}

      {isEditing ? (
        <div className="flex-1 flex gap-1 items-center">
          <Input
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave} // Maybe remove onBlur to allow clicking buttons
            autoFocus
            className="h-8 text-sm"
          />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave} onMouseDown={(e) => e.preventDefault()}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="destructive" className="h-8 w-8" onClick={handleCancel} onMouseDown={(e) => e.preventDefault()}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-between overflow-hidden">
          <span
            className={cn(
              "flex-1 text-sm transition-all duration-200 break-all truncate mr-2",
              item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
            )}
            onDoubleClick={() => canEdit && setIsEditing(true)}
            title={item.content}
            data-cy="item-content"
          >
            {item.content}
          </span>

          {canEdit && (
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={() => setIsEditing(true)}
                title={t('common.edit')}
                data-cy="edit-item-btn"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-7 w-7"
                onClick={handleDelete}
                title={t('common.delete')}
                data-cy="delete-item-btn"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={isDeleteOpen} onOpenChange={(open) => !open && setIsDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('list.delete_item_confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-cy="confirm-delete-item-btn">{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
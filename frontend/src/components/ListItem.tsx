import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ListItem as ListItemType, UpdateListItem } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Pencil, Trash2, Check, X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ListItemProps {
  item: ListItemType;
  canEdit: boolean;
  onUpdate: (itemId: string, data: UpdateListItem) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  error?: string | null;
}

export function ListItem({ item, canEdit, onUpdate, onDelete, dragHandleProps, error }: ListItemProps) {
  const { t } = useTranslation();
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

  const confirmDelete = async () => {
    setIsDeleteOpen(false);
    setIsDeleting(true);
    try {
      await onDelete(item.id);
    } catch {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
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
    <>
      <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg group transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
        {canEdit && dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {canEdit && (
          <Checkbox
            checked={item.checked}
            onCheckedChange={handleCheckToggle}
            className="data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
          />
        )}

        {!canEdit && item.checked && (
          <Check className="w-4 h-4 text-green-500 shrink-0" />
        )}

    {isEditing ? (
          <div className="flex-1 flex gap-1 items-center">
            <Input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              autoFocus
              className="h-8 text-sm"
            />
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleSave}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleCancel}
              onMouseDown={(e) => e.preventDefault()}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex justify-between items-start overflow-hidden">
            <span
              className={cn(
                'flex-1 text-sm break-words mr-2 transition-all',
                item.checked
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-700 dark:text-slate-300'
              )}
              onDoubleClick={() => canEdit && setIsEditing(true)}
              title={item.content}
            >
              {item.content}
            </span>

            {canEdit && (
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-400 hover:text-violet-600"
                  onClick={() => setIsEditing(true)}
                  title={t('common.edit')}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-400 hover:text-destructive"
                  onClick={() => setIsDeleteOpen(true)}
                  title={t('common.delete')}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('list.delete_item_confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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

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
import { Pencil, Trash2, GripVertical, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ListItemProps {
  item: ListItemType;
  canEdit: boolean;
  showCheckbox?: boolean;
  onUpdate: (itemId: string, data: UpdateListItem) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  error?: string | null;
}

export function ListItem({ item, canEdit, showCheckbox = true, onUpdate, onDelete, dragHandleProps, error }: ListItemProps) {
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
      <div className="group flex min-h-9 animate-pulse items-center gap-2 rounded-md px-1.5 py-1 pointer-events-none" aria-busy="true">
        <span className="text-sm text-muted-foreground">{t('common.deleting')}</span>
      </div>
    );
  }

  return (
    <>
      <div className="group flex min-h-9 items-center gap-2 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-subtle">
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

        {canEdit && showCheckbox && (
          <Checkbox
            checked={item.checked}
            onCheckedChange={handleCheckToggle}
            aria-label={item.content}
          />
        )}

        {!canEdit && item.checked && (
          <Check className="size-4 shrink-0 text-accent" />
        )}

        {isEditing ? (
          <div className="flex flex-1 flex-col">
            <Input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              autoFocus
              className="h-7 w-full rounded border border-accent bg-surface px-1.5 text-sm"
            />
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <>
            <span
              className={cn(
                'flex-1 text-sm leading-5',
                item.checked
                  ? 'text-muted-foreground line-through decoration-muted-foreground/60'
                  : 'text-foreground'
              )}
              onDoubleClick={() => canEdit && setIsEditing(true)}
              title={item.content}
            >
              {item.content}
            </span>

            {canEdit && (
              <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
                <Button
                  size="icon-dense"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  aria-label={t('common.edit')}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon-dense"
                  variant="ghost-destructive"
                  onClick={() => setIsDeleteOpen(true)}
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </>
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
            <AlertDialogAction onClick={confirmDelete}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

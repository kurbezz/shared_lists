"use client";

import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

export type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the user confirms the delete action.
   * Can return a Promise to allow the dialog to show an internal loading state.
   */
  onConfirm: () => void | Promise<void>;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: React.ReactNode;
  cancelText?: React.ReactNode;
  /**
   * Disables the confirm button (useful while parent mutation is in-flight).
   */
  disabled?: boolean;
  /**
   * Extra className forwarded to `AlertDialogContent`.
   */
  className?: string;
};

/**
 * A small, reusable delete-confirmation dialog component.
 *
 * Intended to be lazy-loaded (e.g. `const DeleteConfirmDialog = lazy(() => import('@/components/DeleteConfirmDialog'))`)
 * so that Radix / dialog-related code is only pulled in when needed.
 */
export default function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  disabled = false,
  className,
}: DeleteConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const isBusy = isPending || disabled;

  async function handleConfirm() {
    if (isBusy) return;

    const result = onConfirm();
    if (result && typeof (result as Promise<void>).then === "function") {
      try {
        setIsPending(true);
        await result;
      } finally {
        setIsPending(false);
      }
    }
    // Intentionally do not auto-close the dialog here — let the parent
    // decide when to close (for example in mutation onSuccess handlers).
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={className}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isBusy}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

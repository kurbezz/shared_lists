"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export type CreatePageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newPageTitle: string;
  setNewPageTitle: (v: string) => void;
  newPageDesc: string;
  setNewPageDesc: (v: string) => void;
  /**
   * Called when the user confirms creation.
   * Can return a Promise to allow the dialog to show an internal loading state.
   */
  onCreate: () => void | Promise<void>;
  /**
   * Parent-controlled pending flag (e.g. mutation status). Optional;
   * the component will also show an internal pending state if `onCreate` returns a Promise.
   */
  isPending?: boolean;
  cancelText?: React.ReactNode;
  submitText?: React.ReactNode;
  className?: string;
};

/**
 * A small, lazy-loadable dialog used for creating pages.
 *
 * Intended usage:
 *  - keep the mutation and modal state in the parent (Dashboard)
 *  - lazy-load this component so Dialog/Radix code is only pulled when the modal is used
 */
export default function CreatePageDialog({
  open,
  onOpenChange,
  newPageTitle,
  setNewPageTitle,
  newPageDesc,
  setNewPageDesc,
  onCreate,
  isPending = false,
  cancelText = "Cancel",
  submitText = "Add",
  className,
}: CreatePageDialogProps) {
  const [internalPending, setInternalPending] = useState(false);
  const busy = internalPending || isPending;

  async function handleCreate() {
    if (busy || !newPageTitle.trim()) return;

    const res = onCreate();
    if (res && typeof (res as Promise<void>).then === "function") {
      try {
        setInternalPending(true);
        await res;
      } finally {
        setInternalPending(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className ?? "sm:max-w-[425px]"}>
        <DialogHeader>
          <DialogTitle>Create new page</DialogTitle>
          <DialogDescription>
            Add a title and optional description for the new page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              placeholder="My new list"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreate();
                }
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={newPageDesc}
              onChange={(e) => setNewPageDesc(e.target.value)}
              placeholder="Optional description"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!newPageTitle.trim() || busy}
            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

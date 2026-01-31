"use client";

import React from "react";
import { useForm } from "@tanstack/react-form";
import { z } from 'zod';
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
  /**
   * Per-field validation errors from the server. Keys are backend field names
   * (e.g. `title`, `description`) and values are the message to display.
   */
  errors?: Record<string, string>;
  /** optional helper to clear a server error for a field when input changes */
  onChangeClear?: (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  /** optional server-errors apply helper from useServerErrors */
  applyToForm?: (form: unknown) => void;
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
  errors = {},
  onChangeClear,
  applyToForm,
}: CreatePageDialogProps) {
  const form = useForm({
    defaultValues: {
      title: newPageTitle,
      description: newPageDesc,
    },
    // client-side validation performed in onSubmit using zod
    onSubmit: async ({ value }) => {
      const schema = z.object({
        title: z.string().min(1, 'Title is required').max(255),
        description: z.string().max(2000).optional(),
      });
      const res = schema.safeParse(value);
      if (!res.success) {
        // apply errors into form so user sees them
        res.error.errors.forEach((issue) => {
          const pathArr = (issue.path || []);
          const field = pathArr.length > 0 ? (pathArr[0] as 'title' | 'description') : 'title';
          try {
            form.setFieldMeta(field, (m: unknown) => ({ ...((m as Record<string, unknown>) || {}), errors: [issue.message] }));
          } catch {
            // ignore
          }
        });
      return;
    }

      const action = onCreate();
      if (action && typeof (action as Promise<void>).then === 'function') {
        await action;
      }
    },
  });

  // keep parent-controlled values in sync
  React.useEffect(() => {
    form.setFieldValue('title', newPageTitle);
  }, [newPageTitle, form]);
  React.useEffect(() => {
    form.setFieldValue('description', newPageDesc);
  }, [newPageDesc, form]);

  // apply server-side validation errors to this form when parent server errors change
  React.useEffect(() => {
    if (applyToForm) applyToForm(form);
  }, [errors, applyToForm, form]);

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
              value={form.getFieldValue('title') ?? ''}
              onChange={(e) => {
                setNewPageTitle(e.target.value);
                form.setFieldValue('title', e.target.value);
                if (onChangeClear) onChangeClear('title')(e);
              }}
              placeholder="My new list"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  form.handleSubmit();
                }
              }}
            />
            {errors["title"] && (
              <p className="text-sm text-destructive mt-1">{errors["title"]}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="desc">Description</Label>
              <Textarea
              id="desc"
              value={form.getFieldValue('description') ?? ''}
              onChange={(e) => {
                setNewPageDesc(e.target.value);
                form.setFieldValue('description', e.target.value);
              }}
              placeholder="Optional description"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  form.handleSubmit();
                }
              }}
            />
            {errors["description"] && (
              <p className="text-sm text-destructive mt-1">{errors["description"]}</p>
            )}
          </div>
        </div>

          <DialogFooter>
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             {cancelText}
           </Button>
           <Button
            onClick={() => form.handleSubmit?.()}
            disabled={!form.getFieldValue('title')?.trim() || isPending}
            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

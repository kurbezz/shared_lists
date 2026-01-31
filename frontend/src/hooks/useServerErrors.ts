import { useState, useCallback } from 'react';
import { parseValidationErrors, getValidationFromError } from '@/lib/validation';

// Hook to manage server-side validation errors.
// - `errors` is a map of field -> message
// - `setFrom` accepts either the raw `errors` array or the full payload
// - `clear` clears all errors; `clearField` clears a single field
// - `onChangeClear(field)` returns an input onChange handler that clears the
//   field's server error when the user types.
export function useServerErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setFrom = useCallback((input: unknown) => {
    setErrors(parseValidationErrors(input));
  }, []);

  const setFromError = useCallback((err: unknown) => {
    const v = getValidationFromError(err) ?? err;
    setErrors(parseValidationErrors(v));
  }, []);

  const clear = useCallback(() => setErrors({}), []);

  const clearField = useCallback((field: string) => {
    setErrors((s) => {
      if (!s || !s[field]) return s;
      const copy = { ...s };
      delete copy[field];
      return copy;
    });
  }, []);

  const onChangeClear = useCallback(
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (errors && errors[field]) clearField(field);
      return e;
    },
    [errors, clearField],
  );

  // Apply current errors to a TanStack form instance.
  // The form object may expose different APIs depending on version; try common ones.
  const applyToForm = useCallback((form: unknown) => {
    if (!form || !errors) return;
    const entries = Object.entries(errors);
    if (entries.length === 0) return;

    // prefer setFieldMeta (FormApi) to attach errors
    type SetFieldMetaFn = (field: string, updater: (meta?: unknown) => unknown) => void;
    type SetErrorMapFn = (map: { fields?: Record<string, Array<{ message: string }>> } | Record<string, unknown>) => void;

    const f = form as { setFieldMeta?: SetFieldMetaFn; setErrorMap?: SetErrorMapFn };
    if (typeof f.setFieldMeta === 'function') {
      entries.forEach(([field, msg]) => {
        try {
          f.setFieldMeta(field, (m: unknown) => ({ ...((m as Record<string, unknown>) || {}), errors: [msg] }));
        } catch {
          // ignore failures for unknown fields
        }
      });
      return;
    }

    // final fallback: setErrorMap (form-core)
    if (typeof f.setErrorMap === 'function') {
      try {
        // form.setErrorMap expects a complex shape; provide a simple fields map
        const map: Record<string, unknown> = { fields: {} };
        entries.forEach(([field, msg]) => {
          map.fields[field] = [{ message: msg }];
        });
        f.setErrorMap(map);
      } catch {
        // ignore
      }
    }
  }, [errors]);

  return { errors, setFrom, setFromError, setErrors, clear, clearField, onChangeClear, applyToForm } as const;
}

export default useServerErrors;

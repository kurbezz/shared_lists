import { useState, useCallback } from 'react';
import { parseValidationErrors, getValidationFromError } from '@/lib/validation';
import * as formHelpers from '@/lib/formHelpers';

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

    // prefer setFieldMeta (FormApi) to attach errors; use centralized helpers
    // to keep `any` casts confined to one place.
    entries.forEach(([field, msg]) => {
      // try setFieldMeta first
      formHelpers.setFieldMetaSafe(form, field, (m: unknown) => ({ ...((m as Record<string, unknown>) || {}), errors: [msg] }));
    });

    // If the form exposes setErrorMap, set a simple fields map as a fallback
    const map: Record<string, unknown> = { fields: {} };
    entries.forEach(([field, msg]) => {
      // fill map.fields
      (map.fields as Record<string, unknown>)[field] = [{ message: msg }];
    });
    formHelpers.setErrorMapSafe(form, map);
  }, [errors]);

  return { errors, setFrom, setFromError, setErrors, clear, clearField, onChangeClear, applyToForm } as const;
}

export default useServerErrors;

// Utilities for interacting with form-like objects (TanStack form variants).
// These helpers centralize `any` casts so callers can remain typed and
// avoid repeating version-dependent logic.

export type SetFieldMetaFn = (field: string, updater: (meta?: unknown) => unknown) => void;
export type SetErrorMapFn = (map: Record<string, unknown>) => void;

export function setFieldMetaSafe(form: unknown, field: string, updater: (meta?: unknown) => unknown) {
  const candidate = form as { setFieldMeta?: (field: string, updater?: (meta?: unknown) => unknown) => void } | null;
  const fn = candidate?.setFieldMeta;
  if (typeof fn === 'function') {
    try {
      fn(field, updater);
    } catch {
      // swallow errors; callers may choose to ignore unknown fields
    }
  }
}

export function setErrorMapSafe(form: unknown, map: Record<string, unknown>) {
  const candidate = form as { setErrorMap?: (map: Record<string, unknown>) => void } | null;
  const fn = candidate?.setErrorMap;
  if (typeof fn === 'function') {
    try {
      fn(map);
    } catch {
      // ignore
    }
  }
}

export default { setFieldMetaSafe, setErrorMapSafe };

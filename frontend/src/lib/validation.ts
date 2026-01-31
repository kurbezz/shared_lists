// Normalize backend validation payloads into a simple field->message map.
// Backend returns JSON: { error: "Validation failed", errors: [{ field, message }, ...] }
// The API client attaches that `errors` array to thrown Error.validation. This
// helper accepts either the raw `errors` array or the full payload and returns
// a Record<string,string> suitable for setting form error state.
export function parseValidationErrors(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;

  // If the caller passed the full payload { errors: [...] }
  const maybe = input as unknown;
  let arr: unknown | undefined;
  if (Array.isArray(maybe)) arr = maybe;
  else if (maybe && typeof maybe === 'object') {
    const obj = maybe as Record<string, unknown>;
    if (Array.isArray(obj.errors)) arr = obj.errors;
  }

  if (!Array.isArray(arr)) return out;

  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const obj = it as Record<string, unknown>;
    const f = obj.field;
    const m = obj.message;
    if (typeof f === 'string' && typeof m === 'string') out[f] = m;
  }

  return out;
}

export function getValidationFromError(err: unknown): unknown | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const rec = err as Record<string, unknown>;
  if (rec.validation !== undefined) return rec.validation;
  return undefined;
}

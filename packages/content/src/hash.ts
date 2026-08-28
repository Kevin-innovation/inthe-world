function sortKeys(value: unknown): unknown {
  if (typeof value === "number") {
    // JSON.stringify maps Infinity/NaN to null.
    if (!Number.isFinite(value)) {
      throw new Error("error_content_hash_nan");
    }
    return value;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const rec = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(rec).sort()) {
    sorted[key] = sortKeys(rec[key]);
  }
  return sorted;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function contentHash(value: unknown): string {
  return fnv1a32(canonicalJson(value)).toString(16).padStart(8, "0");
}

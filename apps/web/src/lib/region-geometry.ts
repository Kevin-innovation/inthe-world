function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable owner → hex so MapLibre paint expressions can parse the color. */
export function ownerFill(countryId: string): string {
  const hash = fnv1a32(countryId);
  const hue = hash % 360;
  const sat = (40 + (hash % 26)) / 100;
  const light = (36 + ((hash >>> 10) % 16)) / 100;
  const chroma = sat * Math.min(light, 1 - light);
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12;
    const mix = light - chroma * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * mix);
  };
  const hex = [channel(0), channel(8), channel(4)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

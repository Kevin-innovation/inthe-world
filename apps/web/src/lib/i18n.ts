import ko from "../messages/ko.json";

export const messages = ko;

export function t(
  path: string,
  args?: Record<string, string | number>,
): string {
  const parts = path.split(".");
  let node: unknown = messages;
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) {
      return path;
    }
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== "string") return path;
  if (!args) return node;
  return node.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = args[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function countryName(id: string): string {
  const path = `country.${id.toLowerCase()}.title`;
  const named = t(path);
  return named === path ? id : named;
}

export function regionName(id: string): string {
  const path = `region.${id}`;
  const named = t(path);
  return named === path ? id : named;
}

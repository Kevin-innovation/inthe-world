import ko from "../messages/ko.json";

export const messages = ko;

export function t(path: string): string {
  const parts = path.split(".");
  let node: unknown = messages;
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) {
      return path;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : path;
}

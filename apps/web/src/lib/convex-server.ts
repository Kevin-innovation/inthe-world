import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

export { api };

export function convexUrl(): string | undefined {
  const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  return url && url.trim() ? url.trim() : undefined;
}

export function tryGetConvex(): ConvexHttpClient | null {
  const url = convexUrl();
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export function getConvex(): ConvexHttpClient {
  const client = tryGetConvex();
  if (!client) {
    throw new Error(
      "Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL. Run `npx convex dev` or set the env vars.",
    );
  }
  return client;
}

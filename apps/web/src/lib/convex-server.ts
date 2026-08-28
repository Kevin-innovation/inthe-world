import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

export { api };

export function getConvex(): ConvexHttpClient {
  const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL. Run `npx convex dev` or set the env vars.",
    );
  }
  return new ConvexHttpClient(url);
}

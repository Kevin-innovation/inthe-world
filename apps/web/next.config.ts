import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@simul/sim", "@simul/db"],
  // Direct apps/web dep + external so the native .node is require()'d, not bundled.
  serverExternalPackages: ["better-sqlite3"],
  // Monorepo: trace files from the workspace root, not apps/web.
  outputFileTracingRoot: path.join(
    fileURLToPath(new URL(".", import.meta.url)),
    "../..",
  ),
  outputFileTracingIncludes: {
    "/api/*": ["../../packages/db/drizzle/**/*"],
    "/api/*/*": ["../../packages/db/drizzle/**/*"],
    "/api/*/*/*": ["../../packages/db/drizzle/**/*"],
  },
};

export default config;

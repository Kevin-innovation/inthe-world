import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@simul/sim", "@simul/db", "@simul/content"],
  // Direct apps/web dep + external so the native .node is require()'d, not bundled.
  // Keep content external so YAML files resolve from packages/content via import.meta.url.
  serverExternalPackages: ["better-sqlite3", "@simul/content"],
  // Monorepo: trace files from the workspace root, not apps/web.
  outputFileTracingRoot: path.join(
    fileURLToPath(new URL(".", import.meta.url)),
    "../..",
  ),
  outputFileTracingIncludes: {
    "/api/*": [
      "../../packages/db/drizzle/**/*",
      "../../packages/content/**/*.yaml",
    ],
    "/api/*/*": [
      "../../packages/db/drizzle/**/*",
      "../../packages/content/**/*.yaml",
    ],
    "/api/*/*/*": [
      "../../packages/db/drizzle/**/*",
      "../../packages/content/**/*.yaml",
    ],
    "/dev/harness": [
      "../../packages/content/seasons/**/*",
      "../../packages/content/countries/**/*",
      "../../packages/content/regions/**/*",
      "../../packages/content/events/**/*",
    ],
    "/assign": ["../../packages/content/**/*.yaml"],
  },
};

export default config;

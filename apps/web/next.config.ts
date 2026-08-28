import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@simul/sim", "@simul/db"],
  serverExternalPackages: ["better-sqlite3"],
  // Monorepo: trace files from the workspace root, not apps/web.
  outputFileTracingRoot: path.join(
    fileURLToPath(new URL(".", import.meta.url)),
    "../..",
  ),
};

export default config;

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../..",
);

function loadRepoEnvLocal(dir: string): void {
  const envPath = path.join(dir, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadRepoEnvLocal(repoRoot);

const config: NextConfig = {
  transpilePackages: ["@simul/sim", "@simul/db", "@simul/content"],
  // Keep content external so YAML files resolve from packages/content via import.meta.url.
  serverExternalPackages: ["@simul/content"],
  // Monorepo: trace files from the workspace root, not apps/web.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/api/*": ["../../packages/content/**/*.yaml"],
    "/api/*/*": ["../../packages/content/**/*.yaml"],
    "/api/*/*/*": ["../../packages/content/**/*.yaml"],
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

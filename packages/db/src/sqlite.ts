import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { INIT_SQL } from "./migrations";
import * as schema from "./schema";

export type SimulDb = ReturnType<typeof drizzle<typeof schema>>;

export type DbHandle = {
  db: SimulDb;
  sqlite: InstanceType<typeof Database>;
};

const globalForDb = globalThis as unknown as { __simulDb?: DbHandle };

function findWorkspaceRoot(): string | undefined {
  const starts = [
    process.cwd(),
    path.dirname(fileURLToPath(import.meta.url)),
  ];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 12; i++) {
      if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return undefined;
}

export function defaultSqlitePath(): string {
  if (process.env.SIMUL_SQLITE) return process.env.SIMUL_SQLITE;
  const root = findWorkspaceRoot() ?? process.cwd();
  return path.join(root, "data", "simul.sqlite");
}

function resolveMigrationsFolder(): string | undefined {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = findWorkspaceRoot();
  const candidates = [
    path.join(here, "../drizzle"),
    path.join(here, "../../drizzle"),
    ...(root ? [path.join(root, "packages/db/drizzle")] : []),
    path.join(process.cwd(), "packages/db/drizzle"),
    path.join(process.cwd(), "../packages/db/drizzle"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "meta/_journal.json"))) return dir;
  }
  return undefined;
}

export function openSqlite(filePath: string): DbHandle {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  const migrationsFolder = resolveMigrationsFolder();
  if (migrationsFolder) {
    migrate(db, { migrationsFolder });
  } else {
    // Next file tracing can omit packages/db/drizzle; schema is still applied.
    sqlite.exec(INIT_SQL);
  }
  return { db, sqlite };
}

export function getDefaultDb(): DbHandle {
  // Next dev reloads this module; reuse the connection so Windows does not lock the file.
  if (!globalForDb.__simulDb) {
    globalForDb.__simulDb = openSqlite(defaultSqlitePath());
  }
  return globalForDb.__simulDb;
}

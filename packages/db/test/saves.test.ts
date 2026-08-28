import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  createTwoNationSave,
  ensureGuest,
  openSqlite,
  runCatchup,
  type DbHandle,
} from "../src/index";
import { guests, saves } from "../src/schema";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);

const tempDirs: string[] = [];
const openHandles: DbHandle[] = [];

function openTempDb(): DbHandle {
  const dir = mkdtempSync(path.join(tmpdir(), "simul-db-"));
  tempDirs.push(dir);
  const handle = openSqlite(path.join(dir, "t.sqlite"));
  openHandles.push(handle);
  return handle;
}

afterEach(() => {
  while (openHandles.length > 0) {
    const handle = openHandles.pop();
    handle?.sqlite.close();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("runCatchup sqlite", () => {
  it("caps 10 days of wall time at 216 weeks", () => {
    const handle = openTempDb();
    const { guestId } = ensureGuest(handle.db, undefined, NOW);
    const save = createTwoNationSave(handle.db, {
      guestId,
      seed: 7,
      ranked: true,
      nowMs: NOW,
      lastTickAtMs: NOW - 10 * 24 * HOUR_MS,
    });
    const result = runCatchup(handle, {
      saveId: save.id,
      guestId,
      body: {},
      nowMs: NOW,
    });
    expect(result.httpStatus).toBe(200);
    if (result.httpStatus !== 200) throw new Error("expected 200");
    expect(result.body.weeks).toBe(216);
    expect(result.body.tickIndex).toBe(216);
    const stored = handle.db
      .select()
      .from(saves)
      .where(eq(saves.id, save.id))
      .get();
    expect(stored?.tickIndex).toBe(216);
    expect(stored?.lastTickAt).toBe(NOW);
  });

  it("advances 2 weeks after 40 minutes", () => {
    const handle = openTempDb();
    const { guestId } = ensureGuest(handle.db, undefined, NOW);
    const save = createTwoNationSave(handle.db, {
      guestId,
      seed: 3,
      ranked: true,
      nowMs: NOW,
      lastTickAtMs: NOW - 40 * MINUTE_MS,
    });
    const result = runCatchup(handle, {
      saveId: save.id,
      guestId,
      body: {},
      nowMs: NOW,
    });
    expect(result.httpStatus).toBe(200);
    if (result.httpStatus !== 200) throw new Error("expected 200");
    expect(result.body.weeks).toBe(2);
    expect(result.body.tickIndex).toBe(2);
  });

  it("does not let a client clock in the body change n", () => {
    const handle = openTempDb();
    const { guestId } = ensureGuest(handle.db, undefined, NOW);
    const save = createTwoNationSave(handle.db, {
      guestId,
      seed: 3,
      ranked: true,
      nowMs: NOW,
      lastTickAtMs: NOW - 40 * MINUTE_MS,
    });
    const rejected = runCatchup(handle, {
      saveId: save.id,
      guestId,
      body: { clientNow: NOW + 10 * 24 * HOUR_MS },
      nowMs: NOW,
    });
    expect(rejected.httpStatus).toBe(400);
    if (rejected.httpStatus !== 400) throw new Error("expected 400");
    expect(rejected.body.error).toBe("client_clock");
    expect(
      handle.db.select().from(saves).where(eq(saves.id, save.id)).get()
        ?.tickIndex,
    ).toBe(0);

    const result = runCatchup(handle, {
      saveId: save.id,
      guestId,
      body: {
        now: NOW + 10 * 24 * HOUR_MS,
        elapsed: 10 * 24 * HOUR_MS,
      },
      nowMs: NOW,
    });
    expect(result.httpStatus).toBe(200);
    if (result.httpStatus !== 200) throw new Error("expected 200");
    expect(result.body.weeks).toBe(2);
    expect(result.body.tickIndex).toBe(2);
  });

  it("returns 403 when the guest cookie does not own the save", () => {
    const handle = openTempDb();
    const owner = ensureGuest(handle.db, undefined, NOW);
    const other = ensureGuest(handle.db, undefined, NOW);
    const save = createTwoNationSave(handle.db, {
      guestId: owner.guestId,
      seed: 1,
      ranked: true,
      nowMs: NOW,
      lastTickAtMs: NOW - 40 * MINUTE_MS,
    });
    const result = runCatchup(handle, {
      saveId: save.id,
      guestId: other.guestId,
      body: {},
      nowMs: NOW,
    });
    expect(result.httpStatus).toBe(403);
    if (result.httpStatus !== 403) throw new Error("expected 403");
    expect(result.body.error).toBe("forbidden");
    const stored = handle.db
      .select()
      .from(saves)
      .where(eq(saves.id, save.id))
      .get();
    expect(stored?.tickIndex).toBe(0);
  });

  it("rejects unbounded unranked harness weeks without ticking", () => {
    const handle = openTempDb();
    const { guestId } = ensureGuest(handle.db, undefined, NOW);
    const save = createTwoNationSave(handle.db, {
      guestId,
      seed: 1,
      ranked: false,
      nowMs: NOW,
      lastTickAtMs: NOW - 40 * MINUTE_MS,
    });
    const result = runCatchup(handle, {
      saveId: save.id,
      guestId,
      body: { ranked: false, weeks: 1e9 },
      nowMs: NOW,
    });
    expect(result.httpStatus).toBe(400);
    if (result.httpStatus !== 400) throw new Error("expected 400");
    expect(result.body.error).toBe("invalid_weeks");
    expect(
      handle.db.select().from(saves).where(eq(saves.id, save.id)).get()
        ?.tickIndex,
    ).toBe(0);
  });
});

describe("ensureGuest", () => {
  it("mints a server UUID and does not insert a client-supplied id", () => {
    const handle = openTempDb();
    const junk = ensureGuest(handle.db, "not-a-uuid", NOW);
    expect(junk.created).toBe(true);
    expect(junk.guestId).not.toBe("not-a-uuid");

    const attacker = "00000000-0000-4000-8000-000000000000";
    const minted = ensureGuest(handle.db, attacker, NOW);
    expect(minted.guestId).not.toBe(attacker);
    expect(
      handle.db.select().from(guests).where(eq(guests.id, attacker)).get(),
    ).toBeUndefined();

    const reused = ensureGuest(handle.db, junk.guestId, NOW);
    expect(reused.created).toBe(false);
    expect(reused.guestId).toBe(junk.guestId);
  });
});

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  assertFiniteStocks,
  createRng,
  makeTwoNationState,
  tick,
  twoNationWorld,
  type GameState,
} from "@simul/sim";
import { planCatchupWeeks } from "./catchup";
import { guests, saves } from "./schema";
import type { DbHandle, SimulDb } from "./sqlite";

export type CatchupResult =
  | {
      httpStatus: 200;
      body: {
        weeks: number;
        tickIndex: number;
        lastTickAt: string;
        status: string;
        interrupted: boolean;
      };
    }
  | {
      httpStatus: 400 | 401 | 403 | 404;
      body: { error: string };
    };

export type SaveRecord = typeof saves.$inferSelect;

export function ensureGuest(
  db: SimulDb,
  cookieId: string | undefined,
  nowMs: number,
): { guestId: string; created: boolean } {
  const existingId = cookieId?.trim() || undefined;
  if (existingId) {
    const row = db
      .select()
      .from(guests)
      .where(eq(guests.id, existingId))
      .get();
    if (row) {
      db.update(guests)
        .set({ lastSeenAt: nowMs })
        .where(eq(guests.id, existingId))
        .run();
      return { guestId: existingId, created: false };
    }
    db.insert(guests)
      .values({
        id: existingId,
        createdAt: nowMs,
        lastSeenAt: nowMs,
      })
      .run();
    return { guestId: existingId, created: true };
  }
  const id = randomUUID();
  db.insert(guests)
    .values({
      id,
      createdAt: nowMs,
      lastSeenAt: nowMs,
    })
    .run();
  return { guestId: id, created: true };
}

export function createTwoNationSave(
  db: SimulDb,
  input: {
    guestId: string;
    seed?: number;
    ranked?: boolean;
    nowMs?: number;
    lastTickAtMs?: number;
  },
): SaveRecord {
  const nowMs = input.nowMs ?? Date.now();
  const lastTickAtMs = input.lastTickAtMs ?? nowMs;
  const id = randomUUID();
  const ranked = input.ranked ?? true;
  const seed = input.seed ?? 1;
  const state = makeTwoNationState(seed);
  state.saveId = id;
  state.ranked = ranked;
  state.lastTickAt = new Date(lastTickAtMs).toISOString();
  assertFiniteStocks(state);
  db.insert(saves)
    .values({
      id,
      guestId: input.guestId,
      seasonId: state.seasonId,
      countryId: state.playerCountryId,
      seed,
      tickIndex: state.tickIndex,
      lastTickAt: lastTickAtMs,
      status: state.status,
      stateJson: JSON.stringify(state),
      ranked,
      createdAt: nowMs,
    })
    .run();
  const row = db.select().from(saves).where(eq(saves.id, id)).get();
  if (!row) throw new Error("save insert failed");
  return row;
}

function parseState(json: string): GameState {
  const state = JSON.parse(json) as GameState;
  assertFiniteStocks(state);
  return state;
}

function applyCatchupTicks(state: GameState, weeks: number): {
  state: GameState;
  interrupted: boolean;
} {
  const world = twoNationWorld();
  let current = state;
  let interrupted = false;
  for (let i = 0; i < weeks; i++) {
    const rng = createRng(current.seed, current.rngCursor);
    const result = tick(current, 1, world, rng);
    current = result.state;
    if (result.interrupted) {
      // pendingEvent auto-resolve is PR9; v1 tick never sets it
      interrupted = true;
      break;
    }
    if (current.status === "ended") break;
  }
  return { state: current, interrupted };
}

export function runCatchup(
  handle: DbHandle,
  input: {
    saveId: string;
    guestId: string | undefined;
    body: unknown;
    nowMs: number;
  },
): CatchupResult {
  return handle.sqlite.transaction(() =>
    runCatchupUnlocked(handle.db, input),
  )();
}

function runCatchupUnlocked(
  db: SimulDb,
  input: {
    saveId: string;
    guestId: string | undefined;
    body: unknown;
    nowMs: number;
  },
): CatchupResult {
  const guestId = input.guestId?.trim() || undefined;
  if (!guestId) {
    return { httpStatus: 401, body: { error: "unauthorized" } };
  }

  const save = db
    .select()
    .from(saves)
    .where(eq(saves.id, input.saveId))
    .get();
  if (!save) {
    return { httpStatus: 404, body: { error: "not_found" } };
  }
  if (save.guestId !== guestId) {
    return { httpStatus: 403, body: { error: "forbidden" } };
  }

  const plan = planCatchupWeeks({
    elapsedMs: input.nowMs - save.lastTickAt,
    ranked: save.ranked,
    body: input.body,
  });
  if (!plan.ok) {
    return { httpStatus: 400, body: { error: plan.error } };
  }

  const loaded = parseState(save.stateJson);
  const applied = applyCatchupTicks(loaded, plan.weeks);
  const lastTickAtIso = new Date(input.nowMs).toISOString();
  applied.state.lastTickAt = lastTickAtIso;
  applied.state.ranked = save.ranked;
  applied.state.saveId = save.id;
  assertFiniteStocks(applied.state);

  db.update(saves)
    .set({
      tickIndex: applied.state.tickIndex,
      lastTickAt: input.nowMs,
      status: applied.state.status,
      stateJson: JSON.stringify(applied.state),
    })
    .where(eq(saves.id, save.id))
    .run();

  db.update(guests)
    .set({ lastSeenAt: input.nowMs })
    .where(eq(guests.id, guestId))
    .run();

  return {
    httpStatus: 200,
    body: {
      weeks: plan.weeks,
      tickIndex: applied.state.tickIndex,
      lastTickAt: lastTickAtIso,
      status: applied.state.status,
      interrupted: applied.interrupted,
    },
  };
}

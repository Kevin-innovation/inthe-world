import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { loadComingStormPack } from "@simul/content/load";
import {
  applyEventChoice,
  assertFiniteStocks,
  autoResolve,
  createRng,
  findEvent,
  makeTwoNationState,
  tick,
  worldFromPack,
  type GameState,
} from "@simul/sim";
import { consumeAssignment, getAssignment } from "./assignments";
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

const GUEST_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isGuestUuid(id: string): boolean {
  return GUEST_UUID.test(id);
}

export function ensureGuest(
  db: SimulDb,
  cookieId: string | undefined,
  nowMs: number,
): { guestId: string; created: boolean } {
  const existingId = cookieId?.trim() || undefined;
  if (existingId && isGuestUuid(existingId)) {
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

export function insertGameSave(
  db: SimulDb,
  input: {
    guestId: string;
    state: GameState;
    nowMs?: number;
    lastTickAtMs?: number;
  },
): SaveRecord {
  const nowMs = input.nowMs ?? Date.now();
  const lastTickAtMs = input.lastTickAtMs ?? nowMs;
  const id = randomUUID();
  const state = input.state;
  state.saveId = id;
  state.lastTickAt = new Date(lastTickAtMs).toISOString();
  assertFiniteStocks(state);
  db.insert(saves)
    .values({
      id,
      guestId: input.guestId,
      seasonId: state.seasonId,
      countryId: state.playerCountryId,
      seed: state.seed,
      tickIndex: state.tickIndex,
      lastTickAt: lastTickAtMs,
      status: state.status,
      stateJson: JSON.stringify(state),
      ranked: state.ranked,
      createdAt: nowMs,
    })
    .run();
  const row = db.select().from(saves).where(eq(saves.id, id)).get();
  if (!row) throw new Error("save insert failed");
  return row;
}

export function findActiveSave(
  db: SimulDb,
  guestId: string,
): SaveRecord | undefined {
  return db
    .select()
    .from(saves)
    .where(and(eq(saves.guestId, guestId), eq(saves.status, "active")))
    .get();
}

export type ConfirmAssignmentResult =
  | { ok: true; save: SaveRecord }
  | {
      ok: false;
      httpStatus: 409;
      error: "active_run";
      saveId: string;
      countryId: string;
    }
  | { ok: false; httpStatus: 404; error: "assignment_not_found" };

export function confirmAssignment(
  db: SimulDb,
  input: {
    guestId: string;
    assignmentId: string;
    state: GameState;
    nowMs?: number;
  },
): ConfirmAssignmentResult {
  const active = findActiveSave(db, input.guestId);
  if (active) {
    return {
      ok: false,
      httpStatus: 409,
      error: "active_run",
      saveId: active.id,
      countryId: active.countryId,
    };
  }
  const draft = getAssignment(input.assignmentId);
  if (!draft || draft.guestId !== input.guestId || draft.consumed) {
    return { ok: false, httpStatus: 404, error: "assignment_not_found" };
  }
  // Persist first so a failed insert leaves the draft reusable instead of rolling a new country.
  const save = insertGameSave(db, {
    guestId: input.guestId,
    state: input.state,
    nowMs: input.nowMs,
  });
  consumeAssignment(input.assignmentId, input.guestId);
  return { ok: true, save };
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
  const world = worldFromPack(loadComingStormPack());
  let current = state;
  let interrupted = false;
  for (let i = 0; i < weeks; i++) {
    const rng = createRng(current.seed, current.rngCursor);
    let result = tick(current, 1, world, rng);
    if (result.interrupted && result.state.pendingEvent) {
      const pending = result.state.pendingEvent;
      const def = findEvent(world.events, pending.eventId);
      const nation = result.state.nations[pending.countryId];
      if (def && nation) {
        const choice = autoResolve(
          def,
          nation.policies,
          nation.stocks.politicalPower,
        );
        result = {
          ...result,
          ...applyEventChoice(result.state, def, pending.countryId, choice.id, {
            autoForPlayer: nation.isPlayer,
          }),
          interrupted: false,
          interruptReason: undefined,
        };
      } else {
        interrupted = true;
        current = result.state;
        break;
      }
    }
    current = result.state;
    if (result.interrupted) {
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

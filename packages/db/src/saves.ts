import { assertFiniteStocks, type GameState } from "@simul/sim";
import type { CatchupPlan } from "./catchup";
import { planCatchupWeeks } from "./catchup";

export type SaveRecord = {
  id: string;
  guestId: string;
  seasonId: string;
  countryId: string;
  seed: number;
  tickIndex: number;
  lastTickAt: number;
  status: string;
  stateJson: string;
  ranked: boolean;
  createdAt: number;
};

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

export function parseState(json: string): GameState {
  const state = JSON.parse(json) as GameState;
  assertFiniteStocks(state);
  return state;
}

export function serializeSaveState(
  state: GameState,
  saveId: string,
  lastTickAtMs: number,
): string {
  state.saveId = saveId;
  state.lastTickAt = new Date(lastTickAtMs).toISOString();
  assertFiniteStocks(state);
  return JSON.stringify(state);
}

export function planCatchupForSave(
  save: { lastTickAt: number; ranked: boolean },
  body: unknown,
  nowMs: number,
): CatchupPlan {
  return planCatchupWeeks({
    elapsedMs: nowMs - save.lastTickAt,
    ranked: save.ranked,
    body,
  });
}

import type { GameState } from "./types";

export function assertFiniteStocks(state: GameState): void {
  for (const id of Object.keys(state.nations).sort()) {
    const nation = state.nations[id];
    if (!nation) continue;
    for (const [key, value] of Object.entries(nation.stocks)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`error_tick_nan: ${id}.${key}`);
      }
    }
    if (!Number.isFinite(nation.derived.laborFactor)) {
      throw new Error(`error_tick_nan: ${id}.laborFactor`);
    }
    if (!Number.isFinite(nation.civBuildPts)) {
      throw new Error(`error_tick_nan: ${id}.civBuildPts`);
    }
    if (!Number.isFinite(nation.milBuildPts)) {
      throw new Error(`error_tick_nan: ${id}.milBuildPts`);
    }
    if (!Number.isFinite(nation.infraBuildPts)) {
      throw new Error(`error_tick_nan: ${id}.infraBuildPts`);
    }
    if (!Number.isFinite(nation.derived.paperStrength)) {
      throw new Error(`error_tick_nan: ${id}.paperStrength`);
    }
    if (!Number.isFinite(nation.derived.forceProjection)) {
      throw new Error(`error_tick_nan: ${id}.forceProjection`);
    }
  }
}

export function cloneGameState(state: GameState): GameState {
  const cloned = JSON.parse(JSON.stringify(state)) as GameState;
  assertFiniteStocks(cloned);
  return cloned;
}

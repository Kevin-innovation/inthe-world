import {
  applyPolicies,
  costPP,
  createRng,
  DEFAULT_POLICIES,
  makePeaceBalancedState,
  seedFrom,
  tick,
  twoNationWorld,
  type GameState,
  type PolicySliders,
  type TickResult,
} from "@simul/sim";
import { diffPolicies } from "./hq-model";

const HARNESS_SEED = seedFrom("dev-harness", "the_coming_storm");

// Fixture snapshot — not live nation stocks. Mutating this would desync every tick.
export const TWO_NATION_WORLD = twoNationWorld();

export function createHarnessState(): GameState {
  return makePeaceBalancedState(HARNESS_SEED);
}

export function playerPolicies(state: GameState): PolicySliders {
  const nation = state.nations[state.playerCountryId];
  return nation ? { ...nation.policies } : { ...DEFAULT_POLICIES };
}

export function previewPolicyCost(
  state: GameState,
  draft: PolicySliders,
): number {
  const nation = state.nations[state.playerCountryId];
  if (!nation) return 0;
  const partial = diffPolicies(nation.policies, draft);
  return costPP(nation.policies, { ...nation.policies, ...partial }, partial);
}

export function applyDraftPolicies(
  state: GameState,
  draft: PolicySliders,
): { state: GameState; spent: number; error?: string } {
  const nation = state.nations[state.playerCountryId];
  const partial = nation
    ? diffPolicies(nation.policies, draft)
    : diffPolicies(DEFAULT_POLICIES, draft);
  // Always go through applyPolicies so failures still return a clone, not `state`.
  return applyPolicies(state, state.playerCountryId, partial);
}

export function tickWeek(state: GameState): TickResult {
  // Recreate from seed+cursor; a held generator would drift after cloned applies.
  const rng = createRng(state.seed, state.rngCursor);
  return tick(state, 1, TWO_NATION_WORLD, rng);
}


import {
  applyPendingChoice,
  applyPolicies,
  costPP,
  createRng,
  DEFAULT_POLICIES,
  tick,
  type GameState,
  type PolicySliders,
  type TickResult,
  type WorldView,
} from "@simul/sim";
import { diffPolicies } from "./hq-model";

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

export function tickWeek(state: GameState, world: WorldView): TickResult {
  // Recreate from seed+cursor; a held generator would drift after cloned applies.
  const rng = createRng(state.seed, state.rngCursor);
  return tick(state, 1, world, rng);
}

export function resolveHarnessEvent(
  state: GameState,
  world: WorldView,
  choiceId: string,
): { state: GameState; newspapers: TickResult["newspapers"]; error?: string } {
  return applyPendingChoice(state, world, choiceId);
}

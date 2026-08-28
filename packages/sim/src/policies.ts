import {
  GREAT_POWER_TAG,
  inferSpiritTags,
  weightTier,
  type CountryWeight,
} from "./assign";
import { cloneGameState } from "./tick";
import type {
  CountryId,
  Doctrine,
  GameState,
  PolicySliders,
} from "./types";

export const FATE_BUDGET = 5;
export const FATE_FACTORY_COST = 2;
export const FATE_SPIRIT_COST = 3;

const NUMERIC_SLIDERS = [
  "taxRate",
  "industrialFocus",
  "tradeOpenness",
  "conscription",
  "milSpending",
  "liberty",
  "propaganda",
  "intervention",
  "alignmentLean",
  "welfare",
  "researchMil",
  "researchInd",
  "researchSoc",
] as const;

const DOCTRINES: ReadonlySet<Doctrine> = new Set([
  "defense",
  "offense",
  "deterrence",
]);

const FATE_FACTORY_CAP = 2;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function flagNumber(
  flags: Record<string, boolean | number>,
  key: string,
): number {
  const value = flags[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clampSlider(key: (typeof NUMERIC_SLIDERS)[number], value: number): number {
  if (key === "alignmentLean") return clamp(value, -100, 100);
  return clamp(value, 0, 100);
}

export function costPP(
  old: PolicySliders,
  next: PolicySliders,
  partial?: Partial<PolicySliders>,
): number {
  let cost = 0;
  for (const key of NUMERIC_SLIDERS) {
    if (partial && partial[key] === undefined) continue;
    const delta = Math.abs(next[key] - old[key]);
    if (delta === 0) continue;
    cost += 15 * (delta / 10);
  }
  const doctrineRequested = !partial || partial.doctrine !== undefined;
  if (doctrineRequested && next.doctrine !== old.doctrine) {
    cost += 40;
  }
  return cost;
}

export function applyPolicies(
  state: GameState,
  countryId: CountryId,
  partial: Partial<PolicySliders>,
): { state: GameState; spent: number; error?: string } {
  const cloned = cloneGameState(state);
  const nation = cloned.nations[countryId];
  if (!nation) {
    return { state: cloned, spent: 0, error: "unknown_country" };
  }

  const applied: PolicySliders = { ...nation.policies };
  for (const key of NUMERIC_SLIDERS) {
    const incoming = partial[key];
    if (incoming === undefined) continue;
    if (!Number.isFinite(incoming)) continue;
    applied[key] = clampSlider(key, incoming);
  }
  if (partial.doctrine !== undefined && DOCTRINES.has(partial.doctrine)) {
    applied.doctrine = partial.doctrine;
  }

  const spent = costPP(nation.policies, applied, partial);
  if (spent > nation.stocks.politicalPower) {
    return { state: cloned, spent: 0, error: "insufficient_pp" };
  }

  nation.policies = applied;
  nation.stocks.politicalPower -= spent;
  return { state: cloned, spent };
}

export function applyFateFactoryBonus(
  state: GameState,
  countryId: CountryId,
  civDelta: number,
  milDelta: number,
): { state: GameState; appliedCiv: number; appliedMil: number; error?: string } {
  const cloned = cloneGameState(state);
  if (!Number.isInteger(civDelta) || !Number.isInteger(milDelta)) {
    return {
      state: cloned,
      appliedCiv: 0,
      appliedMil: 0,
      error: "integer_only",
    };
  }

  const nation = cloned.nations[countryId];
  if (!nation) {
    return {
      state: cloned,
      appliedCiv: 0,
      appliedMil: 0,
      error: "unknown_country",
    };
  }

  const usedCiv = flagNumber(nation.flags, "fateCiv");
  const usedMil = flagNumber(nation.flags, "fateMil");
  const appliedCiv = Math.min(
    Math.max(0, civDelta),
    Math.max(0, FATE_FACTORY_CAP - usedCiv),
  );
  const appliedMil = Math.min(
    Math.max(0, milDelta),
    Math.max(0, FATE_FACTORY_CAP - usedMil),
  );

  if (
    appliedCiv === 0 &&
    appliedMil === 0 &&
    (civDelta > 0 || milDelta > 0)
  ) {
    return {
      state: cloned,
      appliedCiv: 0,
      appliedMil: 0,
      error: "fate_cap",
    };
  }

  nation.stocks.civFactories += appliedCiv;
  nation.stocks.milFactories += appliedMil;
  nation.flags.fateCiv = usedCiv + appliedCiv;
  nation.flags.fateMil = usedMil + appliedMil;
  return { state: cloned, appliedCiv, appliedMil };
}

export interface FateSpend {
  civDelta?: number;
  milDelta?: number;
  spiritId?: string;
  spiritTags?: readonly string[];
  fateRemaining?: number;
}

export function applyFateSpends(
  state: GameState,
  countryId: CountryId,
  weights: readonly CountryWeight[],
  spend: FateSpend = {},
): {
  state: GameState;
  fateRemaining: number;
  appliedCiv: number;
  appliedMil: number;
  error?: string;
} {
  const fateRemaining = spend.fateRemaining ?? FATE_BUDGET;
  const cloned = cloneGameState(state);
  const empty = {
    state: cloned,
    fateRemaining,
    appliedCiv: 0,
    appliedMil: 0,
  };
  const nation = cloned.nations[countryId];
  if (!nation) {
    return { ...empty, error: "unknown_country" };
  }
  const row = weights.find((entry) => entry.id === countryId);
  if (!row) {
    return { ...empty, error: "unknown_country" };
  }

  let cost = 0;
  const spiritId = spend.spiritId?.trim() || undefined;
  if (spiritId) {
    const tags = new Set([
      ...(spend.spiritTags ?? []),
      ...inferSpiritTags(spiritId, weights),
    ]);
    // ETH (weight 11) must not receive a USA/great-power spirit from fate.
    if (tags.has(GREAT_POWER_TAG) && weightTier(row.weight) === "minor") {
      return { ...empty, error: "great_power_spirit" };
    }
    cost += FATE_SPIRIT_COST;
  }

  const civDelta = spend.civDelta ?? 0;
  const milDelta = spend.milDelta ?? 0;
  let appliedCiv = 0;
  let appliedMil = 0;
  if (civDelta !== 0 || milDelta !== 0) {
    const preview = applyFateFactoryBonus(cloned, countryId, civDelta, milDelta);
    if (preview.error) {
      return { ...empty, error: preview.error };
    }
    appliedCiv = preview.appliedCiv;
    appliedMil = preview.appliedMil;
    cost += (appliedCiv + appliedMil) * FATE_FACTORY_COST;
  }

  if (cost > fateRemaining) {
    return { ...empty, error: "insufficient_fate" };
  }

  let next = cloned;
  if (appliedCiv !== 0 || appliedMil !== 0) {
    const applied = applyFateFactoryBonus(next, countryId, civDelta, milDelta);
    next = applied.state;
    appliedCiv = applied.appliedCiv;
    appliedMil = applied.appliedMil;
  }
  if (spiritId) {
    const target = next.nations[countryId];
    if (target && !target.spirits.includes(spiritId)) {
      target.spirits.push(spiritId);
    }
  }
  next.fateSpent += cost;
  return {
    state: next,
    fateRemaining: fateRemaining - cost,
    appliedCiv,
    appliedMil,
  };
}

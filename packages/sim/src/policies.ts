import { cloneGameState } from "./tick";
import type {
  CountryId,
  Doctrine,
  GameState,
  PolicySliders,
} from "./types";

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

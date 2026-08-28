import type { Doctrine, GameDate, NationStocks, PolicySliders } from "@simul/sim";

export const HQ_STAT_KEYS = [
  "civFactories",
  "milFactories",
  "infra",
  "manpowerPool",
  "armySize",
  "gdp",
  "treasury",
  "debt",
  "inflation",
  "politicalPower",
  "stability",
  "warSupport",
] as const satisfies ReadonlyArray<keyof NationStocks>;

export type HqStatKey = (typeof HQ_STAT_KEYS)[number];

export const NUMERIC_POLICY_KEYS = [
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
] as const satisfies ReadonlyArray<keyof PolicySliders>;

export type NumericPolicyKey = (typeof NUMERIC_POLICY_KEYS)[number];

export const DOCTRINES = ["defense", "offense", "deterrence"] as const satisfies ReadonlyArray<Doctrine>;

export type PolicyGroupId =
  | "economy"
  | "military"
  | "politics"
  | "diplomacy"
  | "society"
  | "research";

export type PolicyField =
  | { key: NumericPolicyKey; kind: "range"; min: number; max: number }
  | { key: "doctrine"; kind: "doctrine" };

export interface PolicyGroup {
  id: PolicyGroupId;
  fields: readonly PolicyField[];
}

export const POLICY_GROUPS: readonly PolicyGroup[] = [
  {
    id: "economy",
    fields: [
      { key: "taxRate", kind: "range", min: 0, max: 100 },
      { key: "industrialFocus", kind: "range", min: 0, max: 100 },
      { key: "tradeOpenness", kind: "range", min: 0, max: 100 },
    ],
  },
  {
    id: "military",
    fields: [
      { key: "conscription", kind: "range", min: 0, max: 100 },
      { key: "doctrine", kind: "doctrine" },
      { key: "milSpending", kind: "range", min: 0, max: 100 },
    ],
  },
  {
    id: "politics",
    fields: [
      { key: "liberty", kind: "range", min: 0, max: 100 },
      { key: "propaganda", kind: "range", min: 0, max: 100 },
    ],
  },
  {
    id: "diplomacy",
    fields: [
      { key: "intervention", kind: "range", min: 0, max: 100 },
      { key: "alignmentLean", kind: "range", min: -100, max: 100 },
    ],
  },
  {
    id: "society",
    fields: [{ key: "welfare", kind: "range", min: 0, max: 100 }],
  },
  {
    id: "research",
    fields: [
      { key: "researchMil", kind: "range", min: 0, max: 100 },
      { key: "researchInd", kind: "range", min: 0, max: 100 },
      { key: "researchSoc", kind: "range", min: 0, max: 100 },
    ],
  },
];

export function formatGameDate(date: GameDate): string {
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  return `${date.year}-${mm}-${dd}`;
}

export function formatStat(key: HqStatKey, value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (key === "inflation") return `${value.toFixed(1)}%`;
  if (
    key === "gdp" ||
    key === "treasury" ||
    key === "debt" ||
    key === "politicalPower" ||
    key === "manpowerPool" ||
    key === "armySize"
  ) {
    return value.toFixed(1);
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export function diffPolicies(
  from: PolicySliders,
  to: PolicySliders,
): Partial<PolicySliders> {
  const partial: Partial<PolicySliders> = {};
  for (const key of NUMERIC_POLICY_KEYS) {
    if (from[key] !== to[key]) partial[key] = to[key];
  }
  if (from.doctrine !== to.doctrine) partial.doctrine = to.doctrine;
  return partial;
}

export function isDoctrine(value: string): value is Doctrine {
  return (DOCTRINES as readonly string[]).includes(value);
}

export function doctrineMessageKey(doctrine: Doctrine): string {
  if (doctrine === "offense") return "policy.doctrineOffense";
  if (doctrine === "deterrence") return "policy.doctrineDeterrence";
  return "policy.doctrineDefense";
}

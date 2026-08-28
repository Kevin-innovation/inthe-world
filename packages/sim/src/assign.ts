import type { Rng } from "./types";

export const WEIGHT_GREAT = 8;
export const WEIGHT_REGIONAL = 10;
export const WEIGHT_MINOR = 11;
export const GREAT_POWER_TAG = "great_power";

export type WeightTier = "great" | "regional" | "minor";

export interface CountryWeight {
  id: string;
  weight: number;
}

export function countryWeights(
  countries: readonly CountryWeight[],
): CountryWeight[] {
  return countries.map((row) => ({ id: row.id, weight: row.weight }));
}

export function weightTier(weight: number): WeightTier {
  if (weight <= WEIGHT_GREAT) return "great";
  if (weight <= WEIGHT_REGIONAL) return "regional";
  return "minor";
}

export function inferSpiritTags(
  spiritId: string,
  weights: readonly CountryWeight[],
): string[] {
  const upper = spiritId.toUpperCase();
  const prefix = upper.split(/[:/_-]/)[0] ?? upper;
  for (const row of weights) {
    if (weightTier(row.weight) !== "great") continue;
    const id = row.id.toUpperCase();
    if (upper === id || prefix === id) return [GREAT_POWER_TAG];
  }
  return [];
}

// Weights come from country YAML (great 8 / regional 10 / minor 11) so new nations join the table without code changes.
export function assignCountry(
  weights: readonly CountryWeight[],
  rng: Rng,
): string {
  if (weights.length === 0) {
    throw new Error("error_assign_empty");
  }
  let total = 0;
  for (const row of weights) {
    if (!Number.isFinite(row.weight) || row.weight <= 0) {
      throw new Error(`error_assign_weight: ${row.id}`);
    }
    total += row.weight;
  }
  const roll = rng.next() * total;
  let acc = 0;
  for (const row of weights) {
    acc += row.weight;
    if (roll < acc) return row.id;
  }
  return weights[weights.length - 1]!.id;
}

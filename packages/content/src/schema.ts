import { z } from "zod";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const factionSchema = z.enum([
  "status_quo",
  "revisionist",
  "revolutionary",
  "nonaligned",
]);

export const terrainSchema = z.enum([
  "plains",
  "forest",
  "hills",
  "mountains",
  "urban",
  "desert",
  "jungle",
  "coastal",
]);

export const resourceBaseSchema = z.object({
  food: z.number().finite(),
  steel: z.number().finite(),
  oil: z.number().finite(),
  rares: z.number().finite(),
});

export const countryStocksSchema = z.object({
  civFactories: z.number().finite().nonnegative(),
  milFactories: z.number().finite().nonnegative(),
  infra: z.number().finite(),
  population: z.number().finite(),
  armySize: z.number().finite(),
  gdp: z.number().finite(),
  treasury: z.number().finite(),
  debt: z.number().finite(),
  inflation: z.number().finite(),
  politicalPower: z.number().finite(),
  stability: z.number().finite(),
  warSupport: z.number().finite(),
  researchMil: z.number().finite(),
  researchInd: z.number().finite(),
  researchSoc: z.number().finite(),
  food: z.number().finite(),
  steel: z.number().finite(),
  oil: z.number().finite(),
  rares: z.number().finite(),
  munitions: z.number().finite().default(0),
  consumerGoods: z.number().finite().default(0),
});

export const countrySchema = z.object({
  id: z.string().min(1),
  titleKey: z.string().min(1),
  weight: z.number().finite().positive(),
  capitalRegion: z.string().min(1),
  faction: factionSchema,
  stocks: countryStocksSchema,
  base: resourceBaseSchema,
});

export const countriesFileSchema = z
  .array(countrySchema)
  .min(1)
  .refine(
    (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
    { message: "duplicate country id" },
  );

export const regionSchema = z.object({
  id: z.string().min(1),
  owner: z.string().min(1),
  controller: z.string().min(1).optional(),
  terrain: terrainSchema,
  coastal: z.boolean(),
});

export const regionsFileSchema = z.array(regionSchema).refine(
  (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
  { message: "duplicate region id" },
);

export const tensionPointSchema = z.object({
  at: isoDateSchema,
  value: z.number().finite(),
});

export const seasonDefinitionSchema = z.object({
  id: z.literal("the_coming_storm"),
  titleKey: z.string().min(1),
  blurbKey: z.string().min(1),
  start: isoDateSchema,
  end: isoDateSchema,
  tensionSchedule: z.array(tensionPointSchema),
  countrySetup: z.string().min(1),
  regionSetup: z.string().min(1),
  eventPack: z.array(z.string()).default([]),
});

export const seasonPackSchema = seasonDefinitionSchema.extend({
  countries: countriesFileSchema,
  regions: regionsFileSchema.default([]),
});

export type CountryDefinition = z.output<typeof countrySchema>;
export type RegionDefinition = z.output<typeof regionSchema>;
export type TensionPoint = z.output<typeof tensionPointSchema>;
export type SeasonDefinitionContent = z.output<typeof seasonDefinitionSchema>;
export type SeasonPack = z.output<typeof seasonPackSchema>;

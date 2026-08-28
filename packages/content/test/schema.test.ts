import { describe, expect, it } from "vitest";
import {
  countrySchema,
  regionsFileSchema,
  tensionPointSchema,
} from "../src/schema";
import { loadComingStormPack } from "../src/load";

describe("country schema", () => {
  it("rejects missing id", () => {
    const pack = loadComingStormPack();
    const usa = pack.countries.find((row) => row.id === "USA");
    if (!usa) throw new Error("missing USA");
    const { id: _id, ...rest } = usa;
    void _id;
    expect(countrySchema.safeParse(rest).success).toBe(false);
  });

  it("rejects negative civFactories", () => {
    const pack = loadComingStormPack();
    const usa = pack.countries.find((row) => row.id === "USA");
    if (!usa) throw new Error("missing USA");
    const result = countrySchema.safeParse({
      ...usa,
      stocks: { ...usa.stocks, civFactories: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative milFactories", () => {
    const pack = loadComingStormPack();
    const usa = pack.countries.find((row) => row.id === "USA");
    if (!usa) throw new Error("missing USA");
    const result = countrySchema.safeParse({
      ...usa,
      stocks: { ...usa.stocks, milFactories: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-finite stock, base, and weight numbers", () => {
    const pack = loadComingStormPack();
    const usa = pack.countries.find((row) => row.id === "USA");
    if (!usa) throw new Error("missing USA");
    expect(
      countrySchema.safeParse({
        ...usa,
        stocks: { ...usa.stocks, civFactories: Number.POSITIVE_INFINITY },
      }).success,
    ).toBe(false);
    expect(
      countrySchema.safeParse({
        ...usa,
        base: { ...usa.base, oil: Number.NEGATIVE_INFINITY },
      }).success,
    ).toBe(false);
    expect(
      countrySchema.safeParse({ ...usa, weight: Number.POSITIVE_INFINITY })
        .success,
    ).toBe(false);
  });
});

describe("regions schema", () => {
  it("rejects duplicate region ids", () => {
    const row = {
      id: "us_east",
      owner: "USA",
      terrain: "plains" as const,
      coastal: true,
    };
    expect(regionsFileSchema.safeParse([]).success).toBe(true);
    expect(regionsFileSchema.safeParse([row]).success).toBe(true);
    expect(regionsFileSchema.safeParse([row, { ...row }]).success).toBe(false);
  });
});

describe("tension schema", () => {
  it("rejects non-finite tension values", () => {
    expect(
      tensionPointSchema.safeParse({
        at: "1936-03-01",
        value: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
  });
});

describe("the_coming_storm YAML", () => {
  it("accepts the season pack with at least four countries", () => {
    const pack = loadComingStormPack();
    expect(pack.id).toBe("the_coming_storm");
    expect(pack.start).toBe("1936-03-01");
    expect(pack.end).toBe("1948-12-31");
    expect(pack.tensionSchedule.length).toBeGreaterThanOrEqual(2);
    expect(pack.countries.length).toBeGreaterThanOrEqual(4);
    const ids = pack.countries.map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining(["USA", "ETH", "GER", "ENG"]));
    expect(pack.regions.length).toBe(64);
    expect(new Set(pack.regions.map((row) => row.id)).size).toBe(64);
    const regionIds = pack.regions.map((row) => row.id);
    expect(regionIds).toEqual(
      expect.arrayContaining([
        "britain",
        "germany_north",
        "us_east",
        "horn_africa",
      ]),
    );
  });
});

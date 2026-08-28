import { describe, expect, it } from "vitest";
import { countrySchema } from "../src/schema";
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
  });
});

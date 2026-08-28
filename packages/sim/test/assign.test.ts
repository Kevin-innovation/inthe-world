import { describe, expect, it } from "vitest";
import { loadComingStormPack } from "@simul/content/load";
import {
  assignCountry,
  countryWeights,
  createRng,
  weightTier,
} from "../src/index";

describe("assignCountry", () => {
  it("draws ETH more often than USA across 1000 rolls from YAML weights", () => {
    const pack = loadComingStormPack();
    const weights = countryWeights(pack.countries);
    const usa = weights.find((row) => row.id === "USA");
    const eth = weights.find((row) => row.id === "ETH");
    if (!usa || !eth) throw new Error("missing USA/ETH");
    expect(eth.weight).toBeGreaterThan(usa.weight);
    expect(weights.reduce((sum, row) => sum + row.weight, 0)).toBe(35);

    const rng = createRng(12345, 0);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const id = assignCountry(weights, rng);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts.ETH ?? 0).toBeGreaterThan(counts.USA ?? 0);
  });

  it("is deterministic for a mulberry32 seed", () => {
    const weights = countryWeights(loadComingStormPack().countries);
    expect(assignCountry(weights, createRng(7, 0))).toBe(
      assignCountry(weights, createRng(7, 0)),
    );
  });

  it("maps YAML weights onto great/regional/minor tiers", () => {
    expect(weightTier(8)).toBe("great");
    expect(weightTier(10)).toBe("regional");
    expect(weightTier(11)).toBe("minor");
  });
});

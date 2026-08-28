import { describe, expect, it } from "vitest";
import { canonicalJson, contentHash } from "../src/hash";
import { loadComingStormPack } from "../src/load";
import type { SeasonPack } from "../src/schema";

function clonePack(pack: SeasonPack): SeasonPack {
  return JSON.parse(JSON.stringify(pack)) as SeasonPack;
}

describe("contentHash", () => {
  it("is stable for the same pack and hex-encoded", () => {
    const pack = loadComingStormPack();
    const a = contentHash(pack);
    const b = contentHash(clonePack(pack));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it("does not depend on object key insertion order", () => {
    expect(contentHash({ b: 1, a: 2 })).toBe(contentHash({ a: 2, b: 1 }));
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("changes when a country's civFactories change", () => {
    const pack = loadComingStormPack();
    const mutated = clonePack(pack);
    const usa = mutated.countries.find((row) => row.id === "USA");
    if (!usa) throw new Error("missing USA");
    usa.stocks.civFactories += 1;
    expect(contentHash(mutated)).not.toBe(contentHash(pack));
    expect(contentHash(pack)).toBe(contentHash(loadComingStormPack()));
  });
});

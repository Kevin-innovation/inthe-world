import { describe, expect, it } from "vitest";
import { loadComingStormPack } from "@simul/content/load";
import {
  applyFateFactoryBonus,
  applyFateSpends,
  applyPolicies,
  costPP,
  countryWeights,
  makeTwoNationState,
} from "../src/index";

describe("policy PP cost", () => {
  it("charges 40 for a doctrine change", () => {
    const state = makeTwoNationState(1);
    const usa = state.nations.USA;
    if (!usa) throw new Error("missing USA");
    expect(costPP(usa.policies, { ...usa.policies, doctrine: "offense" })).toBe(
      40,
    );
  });

  it("charges 15 for moving taxRate by 10", () => {
    const state = makeTwoNationState(1);
    const usa = state.nations.USA;
    if (!usa) throw new Error("missing USA");
    expect(
      costPP(usa.policies, { ...usa.policies, taxRate: usa.policies.taxRate + 10 }),
    ).toBe(15);
  });

  it("applies sliders when PP is sufficient and rejects when not", () => {
    const state = makeTwoNationState(1);
    const usa = state.nations.USA;
    if (!usa) throw new Error("missing USA");
    usa.stocks.politicalPower = 15;
    const before = JSON.stringify(state);

    const ok = applyPolicies(state, "USA", { taxRate: usa.policies.taxRate + 10 });
    expect(ok.error).toBeUndefined();
    expect(ok.spent).toBe(15);
    expect(ok.state.nations.USA?.policies.taxRate).toBe(usa.policies.taxRate + 10);
    expect(ok.state.nations.USA?.stocks.politicalPower).toBe(0);
    expect(JSON.stringify(state)).toBe(before);

    const poor = applyPolicies(ok.state, "USA", { doctrine: "offense" });
    expect(poor.error).toBe("insufficient_pp");
    expect(poor.spent).toBe(0);
    expect(poor.state.nations.USA?.policies.doctrine).toBe("defense");
    expect(poor.state.nations.USA?.stocks.politicalPower).toBe(0);
  });

  it("does not bill PP to clamp unpatched out-of-range sliders", () => {
    const state = makeTwoNationState(1);
    const usa = state.nations.USA;
    if (!usa) throw new Error("missing USA");
    usa.policies.taxRate = 150;
    usa.stocks.politicalPower = 200;
    const result = applyPolicies(state, "USA", {});
    expect(result.error).toBeUndefined();
    expect(result.spent).toBe(0);
    expect(result.state.nations.USA?.policies.taxRate).toBe(150);
    expect(result.state.nations.USA?.stocks.politicalPower).toBe(200);
  });

  it("rejects non-finite stocks instead of cloning NaN to null", () => {
    const state = makeTwoNationState(1);
    const usa = state.nations.USA;
    if (!usa) throw new Error("missing USA");
    usa.stocks.politicalPower = Number.NaN;
    expect(() => applyPolicies(state, "USA", { taxRate: 30 })).toThrow(
      /error_tick_nan: USA\.politicalPower/,
    );
    expect(Number.isNaN(state.nations.USA?.stocks.politicalPower)).toBe(true);

    const inf = makeTwoNationState(1);
    const infUsa = inf.nations.USA;
    if (!infUsa) throw new Error("missing USA");
    infUsa.stocks.politicalPower = Number.POSITIVE_INFINITY;
    expect(() => applyFateFactoryBonus(inf, "ETH", 1, 0)).toThrow(
      /error_tick_nan: USA\.politicalPower/,
    );
  });
});

describe("fate factory cap", () => {
  it("adds at most +2 civ/mil and cannot make ETH equal USA", () => {
    const start = makeTwoNationState(2);
    const eth0 = start.nations.ETH;
    const usa0 = start.nations.USA;
    if (!eth0 || !usa0) throw new Error("missing nations");
    expect(eth0.stocks.civFactories).toBe(2);
    expect(usa0.stocks.civFactories).toBe(110);

    const plus2 = applyFateFactoryBonus(start, "ETH", 2, 0);
    expect(plus2.error).toBeUndefined();
    expect(plus2.appliedCiv).toBe(2);
    expect(plus2.state.nations.ETH?.stocks.civFactories).toBe(4);
    expect(plus2.state.nations.USA?.stocks.civFactories).toBe(110);
    expect(plus2.state.nations.ETH?.stocks.civFactories).toBeLessThan(
      (plus2.state.nations.USA?.stocks.civFactories ?? 0) / 10,
    );

    const plus3 = applyFateFactoryBonus(start, "ETH", 3, 0);
    expect(plus3.appliedCiv).toBe(2);
    expect(plus3.state.nations.ETH?.stocks.civFactories).toBe(4);
    expect(plus3.state.nations.ETH?.flags.fateCiv).toBe(2);

    const over = applyFateFactoryBonus(plus2.state, "ETH", 1, 0);
    expect(over.error).toBe("fate_cap");
    expect(over.appliedCiv).toBe(0);
    expect(over.state.nations.ETH?.stocks.civFactories).toBe(4);

    const mil3 = applyFateFactoryBonus(start, "ETH", 0, 3);
    expect(mil3.appliedMil).toBe(2);
    expect(mil3.state.nations.ETH?.stocks.milFactories).toBe(3);
    expect(mil3.state.nations.USA?.stocks.milFactories).toBe(10);

    const frac = applyFateFactoryBonus(start, "ETH", 1.5, 0);
    expect(frac.error).toBe("integer_only");
    expect(frac.state.nations.ETH?.stocks.civFactories).toBe(2);
  });
});

describe("fate spends", () => {
  const weights = countryWeights(loadComingStormPack().countries);

  it("caps ETH at +2 civ and still stays far below USA", () => {
    const start = makeTwoNationState(2);
    const plus2 = applyFateSpends(start, "ETH", weights, { civDelta: 2 });
    expect(plus2.error).toBeUndefined();
    expect(plus2.appliedCiv).toBe(2);
    expect(plus2.fateRemaining).toBe(1);
    expect(plus2.state.nations.ETH?.stocks.civFactories).toBe(4);
    expect(plus2.state.nations.ETH?.stocks.civFactories).toBeLessThan(
      (plus2.state.nations.USA?.stocks.civFactories ?? 0) / 10,
    );

    const over = applyFateSpends(plus2.state, "ETH", weights, {
      civDelta: 1,
      fateRemaining: plus2.fateRemaining,
    });
    expect(over.error).toBe("fate_cap");
    expect(over.state.nations.ETH?.stocks.civFactories).toBe(4);
  });

  it("cannot spend fate to give ETH a USA spirit", () => {
    const start = makeTwoNationState(1);
    const before = JSON.stringify(start.nations.ETH?.spirits);
    const blocked = applyFateSpends(start, "ETH", weights, { spiritId: "USA" });
    expect(blocked.error).toBe("great_power_spirit");
    expect(blocked.state.nations.ETH?.spirits).toEqual([]);
    expect(JSON.stringify(start.nations.ETH?.spirits)).toBe(before);

    const tagged = applyFateSpends(start, "ETH", weights, {
      spiritId: "arsenal_of_democracy",
      spiritTags: ["great_power"],
    });
    expect(tagged.error).toBe("great_power_spirit");
    expect(tagged.state.nations.ETH?.spirits).toEqual([]);
  });
});


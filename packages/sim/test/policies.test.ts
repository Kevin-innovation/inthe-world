import { describe, expect, it } from "vitest";
import {
  applyFateFactoryBonus,
  applyPolicies,
  costPP,
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

import { describe, expect, it } from "vitest";
import {
  USA_1936_PEACE_BALANCED,
  createRng,
  makePeaceBalancedState,
  tick,
  twoNationWorld,
  type GameState,
  type WorldView,
} from "../src/index";

function runWeeks(
  state: GameState,
  world: WorldView,
  weeks: number,
): GameState {
  let current = state;
  const rng = createRng(current.seed, current.rngCursor);
  for (let i = 0; i < weeks; i++) {
    current = tick(current, 1, world, rng).state;
  }
  return current;
}

describe("USA_1936_peace_balanced growth spiral", () => {
  it("grows GDP ≥15% with stability ≥50 after 104 weeks", () => {
    const world = twoNationWorld();
    const start = makePeaceBalancedState(42);
    const usa0 = start.nations.USA;
    if (!usa0) throw new Error("missing USA");
    expect(usa0.atWarWith).toEqual([]);
    expect(usa0.policies.industrialFocus).toBeLessThanOrEqual(35);
    expect(usa0.policies.taxRate).toBeGreaterThanOrEqual(18);
    expect(usa0.policies.taxRate).toBeLessThanOrEqual(32);
    expect(usa0.policies.welfare).toBeGreaterThanOrEqual(45);
    expect(usa0.policies.conscription).toBeLessThanOrEqual(30);
    expect(usa0.policies).toEqual(USA_1936_PEACE_BALANCED);

    const startGdp = usa0.stocks.gdp;
    const startCiv = usa0.stocks.civFactories;
    const startInfra = usa0.stocks.infra;

    const week1 = tick(start, 1, world, createRng(start.seed, start.rngCursor)).state;
    const usa1 = week1.nations.USA;
    if (!usa1) throw new Error("missing USA");
    expect(usa1.stocks.gdp).toBeGreaterThan(startGdp * 1.15);

    const after = runWeeks(week1, world, 103);
    const usa = after.nations.USA;
    if (!usa) throw new Error("missing USA");

    expect(after.tickIndex).toBe(104);
    expect(usa.alive).toBe(true);
    expect(usa.stocks.gdp).toBeGreaterThan(startGdp * 1.15);
    expect(usa.stocks.stability).toBeGreaterThanOrEqual(50);
    expect(usa.stocks.civFactories).toBeGreaterThan(startCiv);
    expect(usa.stocks.infra).toBeGreaterThan(startInfra);
    for (const value of Object.values(usa.stocks)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("spends leftover infra pts at the 70-pt threshold", () => {
    const world = twoNationWorld();
    const start = makePeaceBalancedState(3);
    const usa0 = start.nations.USA;
    if (!usa0) throw new Error("missing USA");
    usa0.infraBuildPts = 70;
    const after = tick(start, 1, world, createRng(start.seed, 0)).state;
    const usa = after.nations.USA;
    if (!usa) throw new Error("missing USA");
    expect(usa.stocks.infra).toBe(usa0.stocks.infra + 1);
    expect(usa.infraBuildPts).toBeLessThan(70);
  });

  it("conscription 80 mid-run lowers laborFactor versus the balanced clone", () => {
    const world = twoNationWorld();
    const balanced = runWeeks(makePeaceBalancedState(7), world, 20);
    const drafted = JSON.parse(JSON.stringify(balanced)) as GameState;
    const usaDraft = drafted.nations.USA;
    if (!usaDraft) throw new Error("missing USA");
    usaDraft.policies.conscription = 80;

    const balancedAfter = runWeeks(balanced, world, 20);
    const draftedAfter = runWeeks(drafted, world, 20);
    const b = balancedAfter.nations.USA;
    const d = draftedAfter.nations.USA;
    if (!b || !d) throw new Error("missing USA");

    expect(d.derived.laborFactor).toBeLessThan(b.derived.laborFactor);
    expect(d.stocks.armySize).toBeGreaterThan(b.stocks.armySize);
  });
});

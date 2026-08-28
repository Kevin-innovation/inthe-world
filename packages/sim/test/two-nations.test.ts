import { describe, expect, it } from "vitest";
import {
  createRng,
  makeTwoNationState,
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

describe("two nations 52-week harness", () => {
  it("ticks USA+ETH from 1936-03-01 for 52 weeks", () => {
    const world = twoNationWorld();
    const after = runWeeks(makeTwoNationState(42), world, 52);
    const usa = after.nations.USA;
    const eth = after.nations.ETH;
    if (!usa || !eth) throw new Error("missing nations");

    expect(after.tickIndex).toBe(52);
    expect(after.date).toEqual({ year: 1937, month: 2, day: 28 });
    expect(usa.alive).toBe(true);
    expect(eth.alive).toBe(true);
    expect(usa.stocks.gdp).toBeGreaterThan(eth.stocks.gdp * 2);

    for (const nation of [usa, eth]) {
      expect(Number.isFinite(nation.stocks.treasury)).toBe(true);
      expect(Number.isFinite(nation.stocks.civFactories)).toBe(true);
      expect(Number.isFinite(nation.stocks.armySize)).toBe(true);
      expect(Number.isFinite(nation.derived.laborFactor)).toBe(true);
      expect(Number.isNaN(nation.stocks.treasury)).toBe(false);
      expect(Number.isNaN(nation.derived.laborFactor)).toBe(false);
    }
  });

  it("high conscription lowers laborFactor versus zero conscription", () => {
    const world = twoNationWorld();
    const zero = makeTwoNationState(99);
    const full = makeTwoNationState(99);
    const usaZero = zero.nations.USA;
    const usaFull = full.nations.USA;
    if (!usaZero || !usaFull) throw new Error("missing USA");
    usaZero.policies.conscription = 0;
    usaFull.policies.conscription = 100;

    const zeroAfter = runWeeks(zero, world, 20);
    const fullAfter = runWeeks(full, world, 20);
    const z = zeroAfter.nations.USA;
    const f = fullAfter.nations.USA;
    if (!z || !f) throw new Error("missing USA");

    expect(f.derived.laborFactor).toBeLessThan(z.derived.laborFactor);
    expect(f.stocks.armySize).toBeGreaterThan(z.stocks.armySize);
  });
});

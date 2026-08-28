import { describe, expect, it } from "vitest";
import {
  createRng,
  makeMiniWarOvermobilize,
  miniWarWorld,
  tick,
  type GameState,
  type NationState,
} from "../src/index";

function flagNumber(
  flags: Record<string, boolean | number>,
  key: string,
): number {
  const value = flags[key];
  return typeof value === "number" ? value : 0;
}

function assertFiniteNation(nation: NationState): void {
  for (const value of Object.values(nation.stocks)) {
    expect(Number.isFinite(value)).toBe(true);
  }
  expect(Number.isFinite(nation.derived.laborFactor)).toBe(true);
  expect(Number.isFinite(nation.derived.utilCiv)).toBe(true);
  expect(Number.isFinite(nation.derived.utilMil)).toBe(true);
  expect(Number.isFinite(nation.civBuildPts)).toBe(true);
  expect(Number.isFinite(nation.milBuildPts)).toBe(true);
}

function isSpiralHit(nation: NationState): boolean {
  return (
    nation.stocks.stability < 15 ||
    flagNumber(nation.flags, "h3Weeks") > 0 ||
    nation.alive === false
  );
}

describe("MINI_war_overmobilize death spiral", () => {
  it("collapses stably within 78 weeks without NaN", () => {
    const world = miniWarWorld();
    const start = makeMiniWarOvermobilize(13);
    const mini0 = start.nations.ETH;
    if (!mini0) throw new Error("missing ETH");
    expect(mini0.atWarWith.length).toBeGreaterThan(0);
    expect(mini0.policies.conscription).toBeGreaterThanOrEqual(75);
    expect(mini0.policies.industrialFocus).toBeGreaterThanOrEqual(70);
    expect(mini0.policies.milSpending).toBeGreaterThanOrEqual(70);
    expect(mini0.policies.welfare).toBeLessThanOrEqual(25);
    expect(mini0.stocks.civFactories).toBe(4);
    expect(mini0.stocks.milFactories).toBe(2);

    let current: GameState = start;
    const rng = createRng(current.seed, current.rngCursor);
    let hit = false;
    for (let week = 0; week < 78; week++) {
      current = tick(current, 1, world, rng).state;
      const mini = current.nations.ETH;
      if (!mini) throw new Error("missing ETH");
      assertFiniteNation(mini);
      if (week === 0) {
        expect(Number.isNaN(mini.stocks.gdp)).toBe(false);
        expect(mini.stocks.stability).toBeGreaterThan(0);
      }
      if (isSpiralHit(mini)) hit = true;
    }

    const final = current.nations.ETH;
    if (!final) throw new Error("missing ETH");
    assertFiniteNation(final);
    expect(hit).toBe(true);
  });
});

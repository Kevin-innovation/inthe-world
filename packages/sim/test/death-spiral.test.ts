import { describe, expect, it } from "vitest";
import {
  createRng,
  makeMiniWarOvermobilize,
  makeTwoNationState,
  miniWarWorld,
  tick,
  twoNationWorld,
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
  expect(Number.isFinite(nation.infraBuildPts)).toBe(true);
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

describe("H1 uses start army, not peak", () => {
  function prepEth(armySize: number): GameState {
    const state = makeTwoNationState(5);
    const eth = state.nations.ETH;
    if (!eth) throw new Error("missing ETH");
    eth.stocks.stability = 0;
    eth.stocks.inflation = 80;
    eth.stocks.warSupport = 10;
    eth.stocks.armySize = armySize;
    eth.policies.conscription = 0;
    eth.policies.welfare = 0;
    eth.policies.taxRate = 50;
    eth.runStats.startArmy = 80;
    eth.runStats.peakArmy = 400;
    return state;
  }

  it("revolts when army is above 40% of start", () => {
    let current = prepEth(80);
    const world = twoNationWorld();
    const rng = createRng(current.seed, 0);
    for (let i = 0; i < 4; i++) {
      current = tick(current, 1, world, rng).state;
    }
    const eth = current.nations.ETH;
    if (!eth) throw new Error("missing ETH");
    expect(eth.alive).toBe(true);
    expect(eth.runStats.hadRevolution).toBe(true);
    expect(eth.stocks.stability).toBe(25);
  });

  it("collapses when army is below 40% of start", () => {
    let current = prepEth(20);
    const world = twoNationWorld();
    const rng = createRng(current.seed, 0);
    for (let i = 0; i < 4; i++) {
      current = tick(current, 1, world, rng).state;
    }
    const eth = current.nations.ETH;
    if (!eth) throw new Error("missing ETH");
    expect(eth.alive).toBe(false);
    expect(eth.runStats.collapseWeek).toBe(4);
  });
});

describe("H4 famine is post-consume food with no harvest", () => {
  it("collapses after 8 weeks of empty granary and zero harvest", () => {
    const world = twoNationWorld();
    world.resourceBase.ETH = { food: 0, steel: 0.5, oil: 1, rares: 1 };
    let current = makeTwoNationState(8);
    const eth0 = current.nations.ETH;
    if (!eth0) throw new Error("missing ETH");
    eth0.stocks.food = 0;
    eth0.policies.tradeOpenness = 0;
    eth0.stocks.treasury = 0;
    const rng = createRng(current.seed, 0);
    for (let i = 0; i < 8; i++) {
      current = tick(current, 1, world, rng).state;
      const eth = current.nations.ETH;
      if (!eth) throw new Error("missing ETH");
      if (i < 7) {
        expect(eth.alive).toBe(true);
        expect(flagNumber(eth.flags, "h4Weeks")).toBe(i + 1);
      }
    }
    const eth = current.nations.ETH;
    if (!eth) throw new Error("missing ETH");
    expect(eth.alive).toBe(false);
  });

  it("does not count harvest-and-eat-all as famine", () => {
    const world = twoNationWorld();
    let current = makeTwoNationState(8);
    const eth0 = current.nations.ETH;
    if (!eth0) throw new Error("missing ETH");
    eth0.policies.tradeOpenness = 0;
    const rng = createRng(current.seed, 0);
    for (let i = 0; i < 8; i++) {
      current = tick(current, 1, world, rng).state;
    }
    const eth = current.nations.ETH;
    if (!eth) throw new Error("missing ETH");
    expect(eth.alive).toBe(true);
    expect(flagNumber(eth.flags, "h4Weeks")).toBe(0);
  });
});


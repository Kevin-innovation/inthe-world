import { describe, expect, it } from "vitest";
import { loadComingStormPack } from "@simul/content/load";
import {
  createRng,
  doctrineMod,
  loadSeason,
  makePeaceBalancedState,
  makeTwoNationState,
  paperStrength,
  resolvePulse,
  tick,
  twoNationWorld,
  type GameState,
  type RegionState,
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

function region(
  id: string,
  owner: string,
  terrain: RegionState["terrain"],
  coastal: boolean,
  neighbors: string[],
): RegionState {
  return {
    id,
    owner,
    controller: owner,
    terrain,
    coastal,
    factoryDamage: 0,
    neighbors,
  };
}

function makeSixRegionWar(seed: number, intensity: 1 | 2 | 3 = 3): GameState {
  const state = makeTwoNationState(seed);
  const usa = state.nations.USA;
  const eth = state.nations.ETH;
  if (!usa || !eth) throw new Error("missing nations");
  usa.atWarWith = ["ETH"];
  eth.atWarWith = ["USA"];
  usa.policies.doctrine = "offense";
  eth.policies.doctrine = "defense";
  state.wars = [
    {
      id: "usa-eth",
      a: ["USA"],
      b: ["ETH"],
      intensity,
      startTick: 0,
    },
  ];
  state.regions = {
    us_east: region("us_east", "USA", "plains", true, [
      "us_west",
      "horn_africa",
    ]),
    us_west: region("us_west", "USA", "plains", true, ["us_east", "us_midwest"]),
    us_midwest: region("us_midwest", "USA", "forest", false, ["us_west"]),
    horn_africa: region("horn_africa", "ETH", "desert", false, [
      "eth_highlands",
      "eth_coast",
      "us_east",
    ]),
    eth_highlands: region("eth_highlands", "ETH", "mountains", false, [
      "horn_africa",
    ]),
    eth_coast: region("eth_coast", "ETH", "coastal", true, ["horn_africa"]),
  };
  return state;
}

describe("doctrineMod", () => {
  it("is 0.92 for offense vs defense and 1.08 for the reverse", () => {
    expect(doctrineMod("offense", "defense")).toBe(0.92);
    expect(doctrineMod("defense", "offense")).toBe(1.08);
    expect(doctrineMod("offense", "offense")).toBe(1.05);
    expect(doctrineMod("deterrence", "offense")).toBe(0.88);
    expect(doctrineMod("deterrence", "defense")).toBe(1.0);
    expect(doctrineMod("defense", "defense")).toBe(1.0);
  });
});

describe("paperStrength", () => {
  it("is finite and positive for zeroed inputs", () => {
    const paper = paperStrength({
      milFactories: 0,
      milEff: 1,
      regionDamage: 0,
      armySize: 0,
      munitions: 0,
      oilSuff: 0,
      doctrine: "deterrence",
      logistics: 0.3,
    });
    expect(Number.isFinite(paper)).toBe(true);
    expect(paper).toBeGreaterThan(0);
  });
});

describe("resolvePulse table", () => {
  const rngHalf = { next: () => 0.5 };

  it("takes the decisive branch and flips when rng is 0.5", () => {
    const high = resolvePulse({
      paperAtt: 100,
      paperDef: 1,
      terrain: "plains",
      doctrineAtt: "offense",
      doctrineDef: "defense",
      logisticsAtt: 1,
      logisticsDef: 1,
      rng: rngHalf,
    });
    expect(high.rngJ).toBe(1);
    expect(high.doctrineMod).toBe(0.92);
    expect(high.outcome).toBe("decisive");
    expect(high.flipped).toBe(true);
    expect(high.attCasRate).toBe(0.015);
    expect(high.defCasRate).toBe(0.11);
  });

  it("takes the loss branch and does not flip when the ratio is reversed", () => {
    const low = resolvePulse({
      paperAtt: 1,
      paperDef: 100,
      terrain: "plains",
      doctrineAtt: "offense",
      doctrineDef: "defense",
      logisticsAtt: 1,
      logisticsDef: 1,
      rng: rngHalf,
    });
    expect(low.outcome).toBe("loss");
    expect(low.flipped).toBe(false);
    expect(low.contestCleared).toBe(false);
    expect(low.attCasRate).toBe(0.08);
    expect(low.defCasRate).toBe(0.025);
  });

  it("takes the win branch without flipping when rng is 0.5", () => {
    const mid = resolvePulse({
      paperAtt: 1.5,
      paperDef: 1,
      terrain: "plains",
      doctrineAtt: "deterrence",
      doctrineDef: "deterrence",
      logisticsAtt: 1,
      logisticsDef: 1,
      rng: rngHalf,
    });
    expect(mid.effective).toBeGreaterThanOrEqual(1.35);
    expect(mid.effective).toBeLessThan(2.2);
    expect(mid.outcome).toBe("win");
    expect(mid.flipped).toBe(false);
    expect(mid.attCasRate).toBe(0.025);
    expect(mid.defCasRate).toBe(0.07);
  });
});

describe("weekly campaign pulses", () => {
  it("is bit-identical for paper, owners, and rngCursor across 8 pulses", () => {
    const world = twoNationWorld();
    const a = runWeeks(makeSixRegionWar(0xc0ffee), world, 8);
    const b = runWeeks(makeSixRegionWar(0xc0ffee), world, 8);
    expect(a.nations.USA?.derived.paperStrength).toBe(
      b.nations.USA?.derived.paperStrength,
    );
    expect(a.nations.ETH?.derived.paperStrength).toBe(
      b.nations.ETH?.derived.paperStrength,
    );
    expect(a.rngCursor).toBe(b.rngCursor);
    expect(a.rngCursor).toBeGreaterThan(0);
    expect(JSON.stringify(a.regions)).toBe(JSON.stringify(b.regions));
    expect(a.chronicle.length).toBeGreaterThan(0);
    expect(a.chronicle[0]?.kind).toBe("battle");
  });

  it("diverges rngCursor or a casualty when the seed changes", () => {
    const world = twoNationWorld();
    const a = runWeeks(makeSixRegionWar(11), world, 8);
    const b = runWeeks(makeSixRegionWar(12), world, 8);
    const armyDiff =
      a.nations.ETH?.stocks.armySize !== b.nations.ETH?.stocks.armySize;
    const cursorDiff = a.rngCursor !== b.rngCursor;
    const ownerDiff = JSON.stringify(a.regions) !== JSON.stringify(b.regions);
    const jitterDiff =
      a.chronicle[0]?.args.effective !== b.chronicle[0]?.args.effective;
    expect(armyDiff || cursorDiff || ownerDiff || jitterDiff).toBe(true);
  });

  it("flips a weak defender region when the attacker has high paper", () => {
    const world = twoNationWorld();
    const state = makeSixRegionWar(7);
    const usa = state.nations.USA;
    const eth = state.nations.ETH;
    if (!usa || !eth) throw new Error("missing nations");
    usa.stocks.milFactories = 80;
    usa.stocks.armySize = 2000;
    usa.stocks.munitions = 8000;
    usa.stocks.researchMil = 80;
    eth.stocks.milFactories = 1;
    eth.stocks.armySize = 8;
    eth.stocks.munitions = 0;
    const result = tick(state, 1, world, { next: () => 0.5 });
    const after = result.state;
    expect(after.regions.horn_africa?.owner).toBe("USA");
    expect(after.regions.us_east?.owner).toBe("USA");
    expect(after.rngCursor).toBeGreaterThan(0);
    expect(result.newspapers.some((row) => row.kind === "battle")).toBe(true);
    expect(after.chronicle.some((row) => row.kind === "battle")).toBe(true);
  });

  it("does not pulse in peacetime and still writes finite paper", () => {
    const world = twoNationWorld();
    const result = tick(
      makePeaceBalancedState(1),
      1,
      world,
      createRng(1, 0),
    );
    expect(result.state.wars).toEqual([]);
    expect(result.state.rngCursor).toBe(0);
    expect(result.newspapers).toEqual([]);
    const usa = result.state.nations.USA;
    if (!usa) throw new Error("missing USA");
    expect(Number.isFinite(usa.derived.paperStrength)).toBe(true);
    expect(Number.isFinite(usa.derived.forceProjection)).toBe(true);
    expect(usa.derived.paperStrength).toBeGreaterThan(0);
  });

  it("skips intensity-1 wars until week 4", () => {
    const world = twoNationWorld();
    const week1 = tick(
      makeSixRegionWar(3, 1),
      1,
      world,
      createRng(3, 0),
    ).state;
    expect(week1.tickIndex).toBe(1);
    expect(week1.rngCursor).toBe(0);
    expect(week1.chronicle).toEqual([]);

    const week4 = runWeeks(makeSixRegionWar(3, 1), world, 4);
    expect(week4.tickIndex).toBe(4);
    expect(week4.rngCursor).toBeGreaterThan(0);
    expect(week4.chronicle.length).toBeGreaterThan(0);
  });

  it("does not open a same-week front behind a flip", () => {
    const world = twoNationWorld();
    const state = makeTwoNationState(7);
    const usa = state.nations.USA;
    const eth = state.nations.ETH;
    if (!usa || !eth) throw new Error("missing nations");
    usa.atWarWith = ["ETH"];
    eth.atWarWith = ["USA"];
    usa.policies.doctrine = "offense";
    eth.policies.doctrine = "defense";
    usa.stocks.milFactories = 80;
    usa.stocks.armySize = 2000;
    usa.stocks.munitions = 8000;
    usa.stocks.researchMil = 80;
    eth.stocks.milFactories = 1;
    eth.stocks.armySize = 8;
    eth.stocks.munitions = 0;
    state.wars = [
      { id: "usa-eth", a: ["USA"], b: ["ETH"], intensity: 3, startTick: 0 },
    ];
    state.regions = {
      front: region("front", "ETH", "plains", false, ["inland", "rear"]),
      inland: region("inland", "ETH", "forest", false, ["front"]),
      rear: region("rear", "USA", "plains", true, ["front"]),
    };
    const after = tick(state, 1, world, { next: () => 0.5 }).state;
    expect(after.regions.front?.owner).toBe("USA");
    expect(after.regions.inland?.owner).toBe("ETH");
    expect(after.regions.inland?.contestedBy).toBeUndefined();
    expect(after.rngCursor).toBe(4);
  });

  it("marks a decisive miss as contested", () => {
    const world = twoNationWorld();
    const state = makeSixRegionWar(7);
    const usa = state.nations.USA;
    const eth = state.nations.ETH;
    if (!usa || !eth) throw new Error("missing nations");
    usa.stocks.milFactories = 80;
    usa.stocks.armySize = 2000;
    usa.stocks.munitions = 8000;
    usa.stocks.researchMil = 80;
    eth.stocks.milFactories = 1;
    eth.stocks.armySize = 8;
    eth.stocks.munitions = 0;
    const draws = [0.5, 0.8, 0.5, 0.8];
    let i = 0;
    const after = tick(state, 1, world, {
      next: () => draws[i++] ?? 0.5,
    }).state;
    expect(after.regions.horn_africa?.owner).toBe("ETH");
    expect(after.regions.horn_africa?.contestedBy).toBe("USA");
  });

  it("pulses loadSeason regions using the static adjacency table", () => {
    const pack = loadComingStormPack();
    const { state, world } = loadSeason(pack, {
      saveId: "s1",
      seed: 1,
      playerCountryId: "USA",
    });
    expect(state.regions.us_east?.neighbors).toBeUndefined();
    expect(state.regions.britain?.neighbors).toBeUndefined();
    const usa = state.nations.USA;
    const eng = state.nations.ENG;
    if (!usa || !eng) throw new Error("missing nations");
    usa.atWarWith = ["ENG"];
    eng.atWarWith = ["USA"];
    state.wars = [
      { id: "usa-eng", a: ["USA"], b: ["ENG"], intensity: 3, startTick: 0 },
    ];
    const after = tick(state, 1, world, createRng(1, 0)).state;
    expect(after.rngCursor).toBeGreaterThan(0);
    const regions = after.chronicle
      .filter((row) => row.kind === "battle")
      .map((row) => String(row.args.region));
    expect(regions).toEqual(expect.arrayContaining(["britain", "us_east"]));
  });

  it("cuts civ/mil output by owned factoryDamageAvg", () => {
    const world = twoNationWorld();
    world.resourceBase.USA = { food: 0, steel: 0, oil: 0, rares: 0 };
    const intact = makeTwoNationState(1);
    const damaged = makeTwoNationState(1);
    damaged.regions = {
      us_east: region("us_east", "USA", "plains", true, []),
    };
    const east = damaged.regions.us_east;
    if (!east) throw new Error("missing region");
    east.factoryDamage = 0.5;
    const intactAfter = tick(intact, 1, world, createRng(1, 0)).state;
    const damagedAfter = tick(damaged, 1, world, createRng(1, 0)).state;
    const intactUsa = intactAfter.nations.USA;
    const damagedUsa = damagedAfter.nations.USA;
    if (!intactUsa || !damagedUsa) throw new Error("missing USA");
    expect(damagedUsa.derived.gdpWeekly).toBeCloseTo(
      intactUsa.derived.gdpWeekly * 0.5,
      6,
    );
  });
});

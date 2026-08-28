import { describe, expect, it } from "vitest";
import { loadComingStormPack } from "@simul/content/load";
import {
  createRng,
  loadSeason,
  makeTwoNationState,
  tick,
  twoNationWorld,
  type GameDate,
  type GameState,
  type PolicySliders,
  type WorldView,
} from "../src/index";

function isoDate(date: GameDate): string {
  const y = String(date.year).padStart(4, "0");
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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

describe("AI slider inertia", () => {
  it("moves non-player GER industrialFocus by at most 3 per week and reaches >= 40 after 1936-06-01", () => {
    const pack = loadComingStormPack();
    const { state, world } = loadSeason(pack, {
      saveId: "ai-ger",
      seed: 1,
      playerCountryId: "USA",
    });
    const ger0 = state.nations.GER;
    if (!ger0) throw new Error("missing GER");
    expect(ger0.isPlayer).toBe(false);
    expect(ger0.policies.industrialFocus).toBe(30);
    const startPp = ger0.stocks.politicalPower;

    let current = state;
    const rng = createRng(current.seed, current.rngCursor);
    let prevFocus = ger0.policies.industrialFocus;
    let reachedJune = false;
    for (let i = 0; i < 20; i++) {
      current = tick(current, 1, world, rng).state;
      const ger = current.nations.GER;
      if (!ger) throw new Error("missing GER");
      expect(Math.abs(ger.policies.industrialFocus - prevFocus)).toBeLessThanOrEqual(
        3,
      );
      prevFocus = ger.policies.industrialFocus;
      if (isoDate(current.date) >= "1936-06-01") {
        expect(ger.policies.industrialFocus).toBeGreaterThanOrEqual(40);
        reachedJune = true;
      }
    }
    expect(reachedJune).toBe(true);

    const week1 = tick(
      state,
      1,
      world,
      createRng(state.seed, state.rngCursor),
    ).state;
    const ger1 = week1.nations.GER;
    if (!ger1) throw new Error("missing GER");
    expect(ger1.stocks.politicalPower).toBeGreaterThan(startPp);
  });

  it("keeps USA non-player intervention <= 15 for 20 weeks at high tension without pearlHarbor", () => {
    const pack = loadComingStormPack();
    const { state, world } = loadSeason(pack, {
      saveId: "ai-usa",
      seed: 2,
      playerCountryId: "ETH",
    });
    const usa0 = state.nations.USA;
    if (!usa0) throw new Error("missing USA");
    expect(usa0.isPlayer).toBe(false);
    usa0.flags = {};
    state.worldTension = 80;
    world.tensionSchedule = [{ at: "1936-03-01", value: 80 }];

    let current = state;
    const rng = createRng(current.seed, current.rngCursor);
    for (let i = 0; i < 20; i++) {
      current = tick(current, 1, world, rng).state;
      const usa = current.nations.USA;
      if (!usa) throw new Error("missing USA");
      expect(usa.policies.intervention).toBeLessThanOrEqual(15);
      expect(current.worldTension).toBeGreaterThan(40);
    }
  });

  it("lets USA intervention rise at most 3/week after flags.pearlHarbor", () => {
    const pack = loadComingStormPack();
    const { state, world } = loadSeason(pack, {
      saveId: "ai-usa-pearl",
      seed: 3,
      playerCountryId: "ETH",
    });
    const usa0 = state.nations.USA;
    if (!usa0) throw new Error("missing USA");
    usa0.flags = { pearlHarbor: 1 };
    usa0.policies.intervention = 15;
    state.worldTension = 80;
    world.tensionSchedule = [{ at: "1936-03-01", value: 80 }];

    const week1 = tick(
      state,
      1,
      world,
      createRng(state.seed, state.rngCursor),
    ).state;
    const usa1 = week1.nations.USA;
    if (!usa1) throw new Error("missing USA");
    expect(usa1.policies.intervention).toBeGreaterThan(15);
    expect(usa1.policies.intervention - 15).toBeLessThanOrEqual(3);

    let current = week1;
    const rng = createRng(current.seed, current.rngCursor);
    let prev = usa1.policies.intervention;
    for (let i = 0; i < 8; i++) {
      current = tick(current, 1, world, rng).state;
      const usa = current.nations.USA;
      if (!usa) throw new Error("missing USA");
      expect(Math.abs(usa.policies.intervention - prev)).toBeLessThanOrEqual(3);
      expect(usa.policies.intervention).toBeGreaterThanOrEqual(prev);
      prev = usa.policies.intervention;
    }
    expect(prev).toBeGreaterThan(15);
  });

  it("does not change player sliders", () => {
    const world = twoNationWorld();
    const start = makeTwoNationState(9);
    const usa0 = start.nations.USA;
    if (!usa0) throw new Error("missing USA");
    expect(usa0.isPlayer).toBe(true);
    const sliders: PolicySliders = { ...usa0.policies };

    const after = runWeeks(start, world, 12);
    const usa = after.nations.USA;
    if (!usa) throw new Error("missing USA");
    expect(usa.policies).toEqual(sliders);
  });

  it("does not consume RNG while updating AI sliders", () => {
    const pack = loadComingStormPack();
    const { state, world } = loadSeason(pack, {
      saveId: "ai-rng",
      seed: 4,
      playerCountryId: "USA",
    });
    const after = runWeeks(state, world, 8);
    expect(after.rngCursor).toBe(0);
  });
});

describe("world tension schedule", () => {
  it("tracks a step schedule toward 40 at 0.15/week and never jumps 35 in one week", () => {
    const world = twoNationWorld();
    world.tensionSchedule = [
      { at: "1936-03-01", value: 5 },
      { at: "1936-04-01", value: 40 },
    ];
    const start = makeTwoNationState(11);
    start.worldTension = 5;

    let current = start;
    const rng = createRng(current.seed, current.rngCursor);
    let prev = current.worldTension;
    let crossedApril = false;
    for (let i = 0; i < 20; i++) {
      current = tick(current, 1, world, rng).state;
      const delta = current.worldTension - prev;
      expect(delta).toBeLessThanOrEqual(0.15 + 1e-9);
      expect(delta).toBeGreaterThanOrEqual(-0.15 - 1e-9);
      expect(Math.abs(delta)).toBeLessThan(35);
      if (isoDate(current.date) >= "1936-04-01") {
        if (!crossedApril) {
          expect(delta).toBeCloseTo(0.15, 10);
          crossedApril = true;
        }
        expect(current.worldTension).toBeGreaterThan(5);
        expect(current.worldTension).toBeLessThan(40);
      }
      prev = current.worldTension;
    }
    expect(crossedApril).toBe(true);
    expect(current.worldTension).toBeGreaterThan(5);
    expect(current.worldTension).toBeLessThan(5 + 35);
  });

  it("keeps current tension when no schedule point applies yet", () => {
    const world = twoNationWorld();
    world.tensionSchedule = [];
    const start = makeTwoNationState(12);
    start.worldTension = 22;
    const after = tick(
      start,
      1,
      world,
      createRng(start.seed, start.rngCursor),
    ).state;
    expect(after.worldTension).toBe(22);
  });
});

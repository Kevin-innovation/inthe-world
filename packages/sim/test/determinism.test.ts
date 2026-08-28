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

function canonicalDump(state: GameState): unknown {
  const nationIds = Object.keys(state.nations).sort();
  const nations: Record<string, Record<string, number>> = {};
  for (const id of nationIds) {
    const nation = state.nations[id];
    if (!nation) continue;
    const stocks: Record<string, number> = {};
    for (const [key, value] of Object.entries(nation.stocks)) {
      stocks[key] = value;
    }
    stocks.laborFactor = nation.derived.laborFactor;
    nations[id] = stocks;
  }
  return JSON.parse(
    JSON.stringify({
      tickIndex: state.tickIndex,
      date: state.date,
      rngCursor: state.rngCursor,
      nations,
    }),
  );
}

describe("determinism", () => {
  it("52-week USA/ETH ticks are bit-identical for the same seed", () => {
    const world = twoNationWorld();
    const a = runWeeks(makeTwoNationState(0xc0ffee), world, 52);
    const b = runWeeks(makeTwoNationState(0xc0ffee), world, 52);
    expect(canonicalDump(a)).toEqual(canonicalDump(b));
    expect(a.tickIndex).toBe(52);
    expect(a.rngCursor).toBe(0);
  });

  it("does not mutate the input state", () => {
    const world = twoNationWorld();
    const state = makeTwoNationState(1);
    const before = JSON.stringify(state);
    tick(state, 1, world, createRng(state.seed, state.rngCursor));
    expect(JSON.stringify(state)).toBe(before);
  });

  it("diverges GDP and armySize when conscription changes", () => {
    const world = twoNationWorld();
    const low = makeTwoNationState(7);
    const high = makeTwoNationState(7);
    const usaLow = low.nations.USA;
    const usaHigh = high.nations.USA;
    if (!usaLow || !usaHigh) throw new Error("missing USA");
    usaLow.policies.conscription = 0;
    usaHigh.policies.conscription = 100;

    const lowAfter = runWeeks(low, world, 52);
    const highAfter = runWeeks(high, world, 52);
    const lowUsa = lowAfter.nations.USA;
    const highUsa = highAfter.nations.USA;
    if (!lowUsa || !highUsa) throw new Error("missing USA");

    expect(highUsa.stocks.armySize).not.toBe(lowUsa.stocks.armySize);
    expect(highUsa.stocks.gdp).not.toBe(lowUsa.stocks.gdp);
  });

  it("ranked ended no-op clones and does not advance", () => {
    const world = twoNationWorld();
    const state = makeTwoNationState(3);
    state.ranked = true;
    state.status = "ended";
    state.tickIndex = 10;
    state.date = { year: 1936, month: 5, day: 10 };
    const result = tick(state, 1, world, createRng(state.seed, state.rngCursor));
    expect(result.state).not.toBe(state);
    expect(result.dtWeeks).toBe(0);
    expect(result.state.tickIndex).toBe(10);
    expect(result.state.date).toEqual({ year: 1936, month: 5, day: 10 });
    expect(JSON.stringify(result.state)).toBe(JSON.stringify(state));
    result.state.tickIndex = 99;
    expect(state.tickIndex).toBe(10);
  });

  it("throws error_tick_nan when a cloned stock is non-finite", () => {
    const world = twoNationWorld();
    const state = makeTwoNationState(1);
    const usa = state.nations.USA;
    if (!usa) throw new Error("missing USA");
    usa.stocks.food = Number.NaN;
    expect(() =>
      tick(state, 1, world, createRng(state.seed, state.rngCursor)),
    ).toThrow(/error_tick_nan: USA\.food/);
    expect(Number.isNaN(usa.stocks.food)).toBe(true);

    const inf = makeTwoNationState(1);
    const infUsa = inf.nations.USA;
    if (!infUsa) throw new Error("missing USA");
    infUsa.stocks.gdp = Number.POSITIVE_INFINITY;
    expect(() => tick(inf, 1, world, createRng(inf.seed, 0))).toThrow(
      /error_tick_nan: USA\.gdp/,
    );
  });

  it("v1 tick always applies one week regardless of dt", () => {
    const world = twoNationWorld();
    const state = makeTwoNationState(1);
    const result = tick(state, 2, world, createRng(state.seed, 0));
    expect(result.dtWeeks).toBe(1);
    expect(result.state.tickIndex).toBe(1);
    expect(result.state.date).toEqual({ year: 1936, month: 3, day: 8 });
  });

  it("throws when WorldView has no resource base for a nation", () => {
    const state = makeTwoNationState(1);
    expect(() =>
      tick(
        state,
        1,
        { resourceBase: {}, tensionSchedule: [] },
        createRng(state.seed, 0),
      ),
    ).toThrow(/error_tick_missing_base: ETH|error_tick_missing_base: USA/);
  });
});

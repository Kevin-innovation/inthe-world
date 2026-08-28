import { describe, expect, it } from "vitest";
import { loadComingStormPack } from "@simul/content/load";
import {
  FIRED_FLAG_PREFIX,
  applyEventChoice,
  autoResolve,
  createRng,
  DEFAULT_POLICIES,
  loadSeason,
  makeTwoNationState,
  tick,
  twoNationWorld,
  type EventChoice,
  type EventDefinition,
  type GameState,
  type WorldView,
} from "../src/index";

function choice(partial: {
  id: string;
  risk: number;
  ppCost?: number;
  doctrine?: number;
}): EventChoice {
  return {
    id: partial.id,
    titleKey: `event.test.${partial.id}`,
    ppCost: partial.ppCost ?? 0,
    tags: {
      risk: partial.risk,
      doctrine: partial.doctrine ?? 0.5,
      intervention: 0.2,
      liberty: 0.5,
    },
    effects: [],
  };
}

function testEvent(choices: EventChoice[]): EventDefinition {
  return {
    id: "test_event",
    titleKey: "event.test.title",
    blurbKey: "event.test.blurb",
    season: "*",
    trigger: { kind: "condition", expr: "alive" },
    choices,
    tags: ["test"],
  };
}

describe("autoResolve", () => {
  it("prefers the low-risk choice when risk tags differ", () => {
    const event = testEvent([
      choice({ id: "danger", risk: 0.7 }),
      choice({ id: "safe", risk: 0.1 }),
    ]);
    const picked = autoResolve(event, DEFAULT_POLICIES, 50);
    expect(picked.id).toBe("safe");
  });

  it("never picks risk>=0.8 unless every choice is that high", () => {
    const mixed = testEvent([
      choice({ id: "reckless", risk: 0.9 }),
      choice({ id: "steady", risk: 0.2 }),
    ]);
    expect(autoResolve(mixed, DEFAULT_POLICIES, 50).id).toBe("steady");

    const allHigh = testEvent([
      choice({ id: "first", risk: 0.85 }),
      choice({ id: "second", risk: 0.95 }),
    ]);
    expect(autoResolve(allHigh, DEFAULT_POLICIES, 50).id).toBe("first");
  });

  it("penalizes choices the nation cannot afford", () => {
    const event = testEvent([
      choice({ id: "pricey", risk: 0.1, ppCost: 80 }),
      choice({ id: "cheap", risk: 0.2, ppCost: 0 }),
    ]);
    expect(autoResolve(event, DEFAULT_POLICIES, 5).id).toBe("cheap");
  });
});

describe("date triggers", () => {
  it("fires anschluss in the March 1938 window for GER", () => {
    const pack = loadComingStormPack();
    const { state, world } = loadSeason(pack, {
      saveId: "anschluss",
      seed: 1,
      playerCountryId: "USA",
    });
    state.date = { year: 1938, month: 3, day: 1 };
    const ger = state.nations.GER;
    if (!ger) throw new Error("missing GER");
    expect(ger.isPlayer).toBe(false);

    const result = tick(state, 1, world, createRng(state.seed, state.rngCursor));
    const after = result.state.nations.GER;
    if (!after) throw new Error("missing GER");
    expect(result.state.date).toEqual({ year: 1938, month: 3, day: 8 });
    expect(after.flags[`${FIRED_FLAG_PREFIX}anschluss`]).toBe(
      result.state.tickIndex,
    );
    expect(
      result.newspapers.some(
        (row) => row.kind === "event" && row.args.eventId === "anschluss",
      ),
    ).toBe(true);
    expect(result.interrupted).toBe(false);
  });

  it("does not fire anschluss for GER outside March 1938", () => {
    const pack = loadComingStormPack();
    const { state, world } = loadSeason(pack, {
      saveId: "anschluss-miss",
      seed: 1,
      playerCountryId: "USA",
    });
    state.date = { year: 1938, month: 2, day: 1 };
    const result = tick(state, 1, world, createRng(state.seed, state.rngCursor));
    expect(result.state.nations.GER?.flags[`${FIRED_FLAG_PREFIX}anschluss`]).toBeUndefined();
    expect(
      result.newspapers.some((row) => row.args.eventId === "anschluss"),
    ).toBe(false);
  });

  it("pauses the player on a matching event when regencyPause is set", () => {
    const pack = loadComingStormPack();
    const loaded = loadSeason(pack, {
      saveId: "pause",
      seed: 1,
      playerCountryId: "GER",
    });
    loaded.state.date = { year: 1938, month: 3, day: 1 };
    const world: WorldView = { ...loaded.world, regencyPause: true };
    const result = tick(
      loaded.state,
      1,
      world,
      createRng(loaded.state.seed, loaded.state.rngCursor),
    );
    expect(result.interrupted).toBe(true);
    expect(result.interruptReason).toBe("event");
    expect(result.state.pendingEvent).toEqual({
      eventId: "anschluss",
      countryId: "GER",
    });
  });

  it("writes a regency newspaper when the player AFK-resolves", () => {
    const pack = loadComingStormPack();
    const { state, world } = loadSeason(pack, {
      saveId: "regency",
      seed: 1,
      playerCountryId: "GER",
    });
    state.date = { year: 1938, month: 3, day: 1 };
    const result = tick(
      state,
      1,
      world,
      createRng(state.seed, state.rngCursor),
    );
    expect(result.interrupted).toBe(false);
    expect(result.state.pendingEvent).toBeUndefined();
    expect(
      result.newspapers.some(
        (row) => row.kind === "event" && row.args.eventId === "anschluss",
      ),
    ).toBe(true);
    expect(result.newspapers.some((row) => row.kind === "regency")).toBe(true);
  });
});

describe("applyEventChoice", () => {
  it("reuses cloneGameState and rejects non-finite stocks", () => {
    const state = makeTwoNationState(1);
    const usa = state.nations.USA;
    if (!usa) throw new Error("missing USA");
    usa.stocks.food = Number.NaN;
    const event = testEvent([
      choice({ id: "safe", risk: 0.1 }),
      choice({ id: "danger", risk: 0.4 }),
    ]);
    expect(() => applyEventChoice(state, event, "USA", "safe")).toThrow(
      /error_tick_nan: USA\.food/,
    );
  });

  it("emits a regency paper when autoForPlayer and the actor is the player", () => {
    const state = makeTwoNationState(1);
    const event = testEvent([
      choice({ id: "safe", risk: 0.1 }),
      choice({ id: "danger", risk: 0.4 }),
    ]);
    const applied = applyEventChoice(state, event, "USA", "safe", {
      autoForPlayer: true,
    });
    expect(applied.newspapers.some((row) => row.kind === "event")).toBe(true);
    expect(applied.newspapers.some((row) => row.kind === "regency")).toBe(true);
    expect(applied.state.nations.USA?.flags[`${FIRED_FLAG_PREFIX}test_event`]).toBe(
      applied.state.tickIndex,
    );
  });
});

describe("existing fixtures stay quiet without an event pack", () => {
  it("lets USA/ETH tick without newspapers or pending events", () => {
    const world = twoNationWorld();
    const start: GameState = makeTwoNationState(42);
    const result = tick(start, 1, world, createRng(start.seed, 0));
    expect(result.state.pendingEvent).toBeUndefined();
    expect(result.newspapers).toEqual([]);
    expect(result.interrupted).toBe(false);
    expect(result.state.nations.USA?.alive).toBe(true);
    expect(result.state.nations.ETH?.alive).toBe(true);
  });
});

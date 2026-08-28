import { describe, expect, it } from "vitest";
import { loadComingStormPack } from "@simul/content/load";
import { makeTwoNationState, worldFromPack } from "@simul/sim";
import { isGuestUuid } from "../src/guest";
import { parseState, serializeSaveState } from "../src/saves";
import { applyCatchupTicks } from "../src/tickLoop";
import { planCatchupWeeks } from "../src/catchup";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);

describe("applyCatchupTicks", () => {
  const world = worldFromPack(loadComingStormPack());

  it("advances 2 weeks", () => {
    const applied = applyCatchupTicks(makeTwoNationState(3), 2, world);
    expect(applied.state.tickIndex).toBe(2);
    expect(applied.interrupted).toBe(false);
  });

  it("no-ops for 0 weeks", () => {
    const applied = applyCatchupTicks(makeTwoNationState(3), 0, world);
    expect(applied.state.tickIndex).toBe(0);
  });
});

describe("planCatchupWeeks wall clock", () => {
  it("caps 10 days of wall time at 216 weeks", () => {
    expect(
      planCatchupWeeks({
        elapsedMs: 10 * 24 * HOUR_MS,
        ranked: true,
        body: {},
      }),
    ).toEqual({ ok: true, weeks: 216 });
  });

  it("gives 2 weeks for 40 minutes", () => {
    expect(
      planCatchupWeeks({
        elapsedMs: 40 * MINUTE_MS,
        ranked: true,
        body: {},
      }),
    ).toEqual({ ok: true, weeks: 2 });
  });
});

describe("serializeSaveState", () => {
  it("stores the player country from GameState", () => {
    const state = makeTwoNationState(4);
    state.playerCountryId = "ETH";
    const parsed = parseState(serializeSaveState(state, "save-eth", NOW));
    expect(parsed.playerCountryId).toBe("ETH");
    expect(parsed.saveId).toBe("save-eth");
    expect(parsed.tickIndex).toBe(0);
    expect(parsed.status).toBe("active");
  });

  it("throws before a NaN state can be persisted", () => {
    const broken = makeTwoNationState(4);
    const usa = broken.nations.USA;
    if (!usa) throw new Error("missing USA");
    usa.stocks.politicalPower = Number.NaN;
    expect(() => serializeSaveState(broken, "save-nan", NOW)).toThrow(
      /error_tick_nan/,
    );
  });
});

describe("isGuestUuid", () => {
  it("accepts RFC-like UUIDs and rejects client junk", () => {
    expect(isGuestUuid("not-a-uuid")).toBe(false);
    expect(isGuestUuid("00000000-0000-4000-8000-000000000000")).toBe(true);
  });
});

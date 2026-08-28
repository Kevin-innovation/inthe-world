import { describe, expect, it } from "vitest";
import {
  MAX_CATCHUP_WEEKS,
  catchupWeeks,
  planCatchupWeeks,
} from "../src/catchup";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

describe("catchupWeeks", () => {
  it("caps 72h wall at 216 weeks even when lastTickAt is 10 days ago", () => {
    const seventyTwoHours = 72 * HOUR_MS;
    const tenDays = 10 * 24 * HOUR_MS;
    expect(catchupWeeks(seventyTwoHours)).toBe(216);
    expect(catchupWeeks(tenDays)).toBe(216);
    expect(catchupWeeks(tenDays)).toBe(MAX_CATCHUP_WEEKS);
  });

  it("gives 2 weeks for 40 minutes", () => {
    expect(catchupWeeks(40 * MINUTE_MS)).toBe(2);
  });

  it("returns 0 for empty or invalid elapsed time", () => {
    expect(catchupWeeks(0)).toBe(0);
    expect(catchupWeeks(-MINUTE_MS)).toBe(0);
    expect(catchupWeeks(Number.NaN)).toBe(0);
  });
});

describe("planCatchupWeeks", () => {
  it("ignores client clock fields when computing n", () => {
    const elapsed = 40 * MINUTE_MS;
    const planned = planCatchupWeeks({
      elapsedMs: elapsed,
      ranked: true,
      body: {
        now: elapsed + 10 * 24 * HOUR_MS,
        elapsed: 99 * HOUR_MS,
        clientElapsed: 1e15,
      },
    });
    expect(planned).toEqual({ ok: true, weeks: 2 });
  });

  it("rejects clientNow in the body", () => {
    const planned = planCatchupWeeks({
      elapsedMs: 40 * MINUTE_MS,
      ranked: true,
      body: { clientNow: 1 },
    });
    expect(planned).toEqual({
      ok: false,
      status: 400,
      error: "client_clock",
    });
  });

  it("does not apply harness weeks on ranked saves", () => {
    const planned = planCatchupWeeks({
      elapsedMs: 40 * MINUTE_MS,
      ranked: true,
      body: { ranked: false, weeks: 1000 },
    });
    expect(planned).toEqual({ ok: true, weeks: 2 });
  });

  it("allows unranked harness weeks only when ranked is false", () => {
    const planned = planCatchupWeeks({
      elapsedMs: 40 * MINUTE_MS,
      ranked: false,
      body: { ranked: false, weeks: 10 },
    });
    expect(planned).toEqual({ ok: true, weeks: 10 });
  });
});

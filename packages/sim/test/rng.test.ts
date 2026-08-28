import { describe, expect, it } from "vitest";
import { createRng, mulberry32, trackRng } from "../src/index";

function skip(gen: () => number, n: number): void {
  for (let i = 0; i < n; i++) gen();
}

describe("createRng / trackRng", () => {
  it("createRng(seed, n) matches n discarded mulberry32 draws", () => {
    const seed = 12345;
    const raw = mulberry32(seed);
    skip(raw, 3);
    const rng = createRng(seed, 3);
    expect(rng.next()).toBe(raw());
    expect(rng.next()).toBe(raw());
  });

  it("trackRng increments cursor on each next() and stays on the stream", () => {
    const seed = 99;
    const start = 4;
    const raw = mulberry32(seed);
    skip(raw, start);
    const tracked = trackRng(createRng(seed, start), start);
    expect(tracked.cursor()).toBe(start);
    expect(tracked.next()).toBe(raw());
    expect(tracked.cursor()).toBe(start + 1);
    expect(tracked.next()).toBe(raw());
    expect(tracked.cursor()).toBe(start + 2);
  });

  it("n rolls through the tick wrap increase cursor by n", () => {
    const start = 7;
    const tracked = trackRng(createRng(42, start), start);
    tracked.next();
    tracked.next();
    tracked.next();
    expect(tracked.cursor()).toBe(start + 3);
  });
});

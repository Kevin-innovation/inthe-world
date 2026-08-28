import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { makeTwoNationState } from "../packages/sim/src/index";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const GUEST = "11111111-1111-4111-8111-111111111111";

describe("assignments.start + saves.confirm", () => {
  it("reuses an open draft and refuses a second country", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("guests", {
        id: GUEST,
        createdAt: now,
        lastSeenAt: now,
      });
    });

    const first = await t.mutation(api.assignments.start, {
      guestId: GUEST,
      seasonId: "the_coming_storm",
      id: "assign-1",
      countryId: "ETH",
      seed: 9,
    });
    expect(first.type).toBe("ok");
    if (first.type !== "ok") throw new Error("expected assignment");
    expect(first.assignment.countryId).toBe("ETH");

    const second = await t.mutation(api.assignments.start, {
      guestId: GUEST,
      seasonId: "the_coming_storm",
      id: "assign-1-dup",
      countryId: "USA",
      seed: 10,
    });
    expect(second.type).toBe("ok");
    if (second.type !== "ok") throw new Error("expected reuse");
    expect(second.assignment.id).toBe("assign-1");
    expect(second.assignment.countryId).toBe("ETH");
  });

  it("returns 409 active_run without consuming the draft", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("guests", {
        id: GUEST,
        createdAt: now,
        lastSeenAt: now,
      });
      await ctx.db.insert("saves", {
        id: "save-active",
        guestId: GUEST,
        seasonId: "the_coming_storm",
        countryId: "USA",
        seed: 1,
        tickIndex: 0,
        lastTickAt: now,
        status: "active",
        stateJson: "{}",
        ranked: true,
        createdAt: now,
      });
    });
    const started = await t.mutation(api.assignments.start, {
      guestId: GUEST,
      seasonId: "the_coming_storm",
      id: "assign-blocked",
      countryId: "ETH",
      seed: 8,
    });
    expect(started).toMatchObject({
      type: "active_run",
      saveId: "save-active",
      countryId: "USA",
    });

    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("assignments", {
        id: "confirm-active-run",
        guestId: GUEST,
        seasonId: "the_coming_storm",
        countryId: "ETH",
        seed: 8,
        consumed: false,
        createdAt: now,
      });
    });
    const confirmed = await t.mutation(api.saves.confirm, {
      guestId: GUEST,
      assignmentId: "confirm-active-run",
      stateJson: JSON.stringify(makeTwoNationState(8)),
    });
    expect(confirmed.ok).toBe(false);
    if (confirmed.ok) throw new Error("expected 409");
    expect(confirmed.httpStatus).toBe(409);
    expect(confirmed.error).toBe("active_run");
    const draft = await t.query(api.assignments.get, {
      assignmentId: "confirm-active-run",
      guestId: GUEST,
    });
    expect(draft?.consumed).toBe(false);
  });

  it("inserts the save then consumes; a failed insert leaves the draft", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("guests", {
        id: GUEST,
        createdAt: now,
        lastSeenAt: now,
      });
      await ctx.db.insert("assignments", {
        id: "confirm-insert-first",
        guestId: GUEST,
        seasonId: "the_coming_storm",
        countryId: "ETH",
        seed: 4,
        consumed: false,
        createdAt: now,
      });
    });

    const broken = makeTwoNationState(4);
    const usa = broken.nations.USA;
    if (!usa) throw new Error("missing USA");
    usa.stocks.politicalPower = Number.NaN;
    await expect(
      t.mutation(api.saves.confirm, {
        guestId: GUEST,
        assignmentId: "confirm-insert-first",
        stateJson: JSON.stringify(broken),
      }),
    ).rejects.toThrow(/error_tick_nan/);

    const leftover = await t.query(api.assignments.get, {
      assignmentId: "confirm-insert-first",
      guestId: GUEST,
    });
    expect(leftover?.consumed).toBe(false);
    const saves = await t.run(async (ctx) => {
      return await ctx.db.query("saves").collect();
    });
    expect(saves).toHaveLength(0);

    const ok = await t.mutation(api.saves.confirm, {
      guestId: GUEST,
      assignmentId: "confirm-insert-first",
      stateJson: JSON.stringify(makeTwoNationState(4)),
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) throw new Error("expected insert");
    expect(ok.save.status).toBe("active");
    const consumed = await t.query(api.assignments.get, {
      assignmentId: "confirm-insert-first",
      guestId: GUEST,
    });
    expect(consumed?.consumed).toBe(true);
  });
});

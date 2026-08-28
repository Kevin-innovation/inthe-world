import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { makeTwoNationState } from "../packages/sim/src/index";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const GUEST = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const MINUTE_MS = 60 * 1000;

async function seedSave(
  t: ReturnType<typeof convexTest>,
  opts: { guestId: string; saveId: string; lastTickAt: number; seed?: number },
) {
  const state = makeTwoNationState(opts.seed ?? 3);
  state.saveId = opts.saveId;
  state.ranked = true;
  await t.run(async (ctx) => {
    await ctx.db.insert("guests", {
      id: opts.guestId,
      createdAt: opts.lastTickAt,
      lastSeenAt: opts.lastTickAt,
    });
    await ctx.db.insert("saves", {
      id: opts.saveId,
      guestId: opts.guestId,
      seasonId: state.seasonId,
      countryId: state.playerCountryId,
      seed: state.seed,
      tickIndex: state.tickIndex,
      lastTickAt: opts.lastTickAt,
      status: state.status,
      stateJson: JSON.stringify(state),
      ranked: true,
      createdAt: opts.lastTickAt,
    });
  });
}

describe("catchup.run", () => {
  it("rejects clientNow without ticking", async () => {
    const t = convexTest(schema, modules);
    const saveId = "save-clock";
    const lastTickAt = Date.now() - 40 * MINUTE_MS;
    await seedSave(t, { guestId: GUEST, saveId, lastTickAt });
    const rejected = await t.action(api.catchup.run, {
      saveId,
      guestId: GUEST,
      body: { clientNow: 1 },
    });
    expect(rejected).toEqual({
      httpStatus: 400,
      body: { error: "client_clock" },
    });
    const stored = await t.run(async (ctx) => {
      return await ctx.db
        .query("saves")
        .withIndex("by_public_id", (q) => q.eq("id", saveId))
        .unique();
    });
    expect(stored?.tickIndex).toBe(0);
  });

  it("returns 403 when the guest cookie does not own the save", async () => {
    const t = convexTest(schema, modules);
    const saveId = "save-forbid";
    const lastTickAt = Date.now() - 40 * MINUTE_MS;
    await seedSave(t, { guestId: GUEST, saveId, lastTickAt });
    await t.run(async (ctx) => {
      await ctx.db.insert("guests", {
        id: OTHER,
        createdAt: lastTickAt,
        lastSeenAt: lastTickAt,
      });
    });
    const result = await t.action(api.catchup.run, {
      saveId,
      guestId: OTHER,
      body: {},
    });
    expect(result).toEqual({
      httpStatus: 403,
      body: { error: "forbidden" },
    });
  });

  it("advances 2 weeks after 40 minutes", async () => {
    const t = convexTest(schema, modules);
    const saveId = "save-two";
    const lastTickAt = Date.now() - 40 * MINUTE_MS;
    await seedSave(t, { guestId: GUEST, saveId, lastTickAt, seed: 3 });
    const result = await t.action(api.catchup.run, {
      saveId,
      guestId: GUEST,
      body: {},
    });
    expect(result.httpStatus).toBe(200);
    if (result.httpStatus !== 200) throw new Error("expected 200");
    expect(result.body.weeks).toBe(2);
    expect(result.body.tickIndex).toBe(2);
  });
});

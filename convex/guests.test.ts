import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("guests.ensure", () => {
  it("mints a server UUID and does not insert a client-supplied id", async () => {
    const t = convexTest(schema, modules);
    const junk = await t.mutation(api.guests.ensure, { cookieId: "not-a-uuid" });
    expect(junk.created).toBe(true);
    expect(junk.guestId).not.toBe("not-a-uuid");

    const attacker = "00000000-0000-4000-8000-000000000000";
    const minted = await t.mutation(api.guests.ensure, { cookieId: attacker });
    expect(minted.guestId).not.toBe(attacker);
    const attackerRow = await t.run(async (ctx) => {
      return await ctx.db
        .query("guests")
        .withIndex("by_public_id", (q) => q.eq("id", attacker))
        .unique();
    });
    expect(attackerRow).toBeNull();

    const reused = await t.mutation(api.guests.ensure, {
      cookieId: junk.guestId,
    });
    expect(reused.created).toBe(false);
    expect(reused.guestId).toBe(junk.guestId);
  });
});

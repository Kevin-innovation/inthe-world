import { v } from "convex/values";
import { isGuestUuid } from "../packages/db/src/guest";
import { mutation } from "./_generated/server";
import { guestByPublicId } from "./model";

export const ensure = mutation({
  args: { cookieId: v.optional(v.string()) },
  returns: v.object({
    guestId: v.string(),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const existingId = args.cookieId?.trim() || undefined;
    if (existingId && isGuestUuid(existingId)) {
      const row = await guestByPublicId(ctx, existingId);
      if (row) {
        await ctx.db.patch(row._id, { lastSeenAt: nowMs });
        return { guestId: existingId, created: false };
      }
    }
    const id = crypto.randomUUID();
    await ctx.db.insert("guests", {
      id,
      createdAt: nowMs,
      lastSeenAt: nowMs,
    });
    return { guestId: id, created: true };
  },
});

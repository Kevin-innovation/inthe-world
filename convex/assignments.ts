import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  assignmentByPublicId,
  assignmentValidator,
  findActiveSave,
  findOpenAssignment,
  toAssignmentPublic,
} from "./model";

export const get = query({
  args: { assignmentId: v.string(), guestId: v.string() },
  returns: v.union(assignmentValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await assignmentByPublicId(ctx, args.assignmentId);
    if (!row || row.guestId !== args.guestId) return null;
    return toAssignmentPublic(row);
  },
});

export const findOpen = query({
  args: { guestId: v.string(), seasonId: v.string() },
  returns: v.union(assignmentValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await findOpenAssignment(ctx, args.guestId, args.seasonId);
    return row ? toAssignmentPublic(row) : null;
  },
});

export const start = mutation({
  args: {
    guestId: v.string(),
    seasonId: v.string(),
    id: v.string(),
    countryId: v.string(),
    seed: v.number(),
    lore: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      type: v.literal("ok"),
      assignment: assignmentValidator,
    }),
    v.object({
      type: v.literal("active_run"),
      saveId: v.string(),
      countryId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const active = await findActiveSave(ctx, args.guestId);
    if (active) {
      return {
        type: "active_run" as const,
        saveId: active.id,
        countryId: active.countryId,
      };
    }
    const existing = await findOpenAssignment(ctx, args.guestId, args.seasonId);
    if (existing) {
      return { type: "ok" as const, assignment: toAssignmentPublic(existing) };
    }
    const createdAt = Date.now();
    await ctx.db.insert("assignments", {
      id: args.id,
      guestId: args.guestId,
      seasonId: args.seasonId,
      countryId: args.countryId,
      seed: args.seed,
      lore: args.lore,
      consumed: false,
      createdAt,
    });
    return {
      type: "ok" as const,
      assignment: {
        id: args.id,
        guestId: args.guestId,
        seasonId: args.seasonId,
        countryId: args.countryId,
        seed: args.seed,
        lore: args.lore,
        consumed: false,
        createdAt,
      },
    };
  },
});

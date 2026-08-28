import { v } from "convex/values";
import { assertFiniteStocks, type GameState } from "../packages/sim/src/index";
import { parseState, serializeSaveState } from "../packages/db/src/saves";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
  assignmentByPublicId,
  findActiveSave,
  guestByPublicId,
  saveByPublicId,
  savePublicValidator,
  toSavePublic,
  type SavePublic,
} from "./model";

export const getActive = query({
  args: { guestId: v.string() },
  returns: v.union(savePublicValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await findActiveSave(ctx, args.guestId);
    return row ? toSavePublic(row) : null;
  },
});

export const confirm = mutation({
  args: {
    guestId: v.string(),
    assignmentId: v.string(),
    stateJson: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      save: savePublicValidator,
    }),
    v.object({
      ok: v.literal(false),
      httpStatus: v.literal(409),
      error: v.literal("active_run"),
      saveId: v.string(),
      countryId: v.string(),
    }),
    v.object({
      ok: v.literal(false),
      httpStatus: v.literal(404),
      error: v.literal("assignment_not_found"),
    }),
  ),
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const active = await findActiveSave(ctx, args.guestId);
    if (active) {
      return {
        ok: false as const,
        httpStatus: 409 as const,
        error: "active_run" as const,
        saveId: active.id,
        countryId: active.countryId,
      };
    }
    const draft = await assignmentByPublicId(ctx, args.assignmentId);
    if (!draft || draft.guestId !== args.guestId || draft.consumed) {
      return {
        ok: false as const,
        httpStatus: 404 as const,
        error: "assignment_not_found" as const,
      };
    }
    const state = parseState(args.stateJson);
    const id = crypto.randomUUID();
    const stateJson = serializeSaveState(state, id, nowMs);
    await ctx.db.insert("saves", {
      id,
      guestId: args.guestId,
      seasonId: state.seasonId,
      countryId: state.playerCountryId,
      seed: state.seed,
      tickIndex: state.tickIndex,
      lastTickAt: nowMs,
      status: state.status,
      stateJson,
      ranked: state.ranked,
      createdAt: nowMs,
    });
    await ctx.db.patch(draft._id, { consumed: true });
    const guest = await guestByPublicId(ctx, args.guestId);
    if (guest) {
      await ctx.db.patch(guest._id, { lastSeenAt: nowMs });
    }
    const save: SavePublic = {
      id,
      guestId: args.guestId,
      seasonId: state.seasonId,
      countryId: state.playerCountryId,
      seed: state.seed,
      tickIndex: state.tickIndex,
      lastTickAt: nowMs,
      status: state.status,
      ranked: state.ranked,
      createdAt: nowMs,
    };
    return { ok: true as const, save };
  },
});

export const loadForCatchup = internalQuery({
  args: { id: v.string() },
  returns: v.union(
    v.object({
      id: v.string(),
      guestId: v.string(),
      lastTickAt: v.number(),
      ranked: v.boolean(),
      stateJson: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await saveByPublicId(ctx, args.id);
    if (!row) return null;
    return {
      id: row.id,
      guestId: row.guestId,
      lastTickAt: row.lastTickAt,
      ranked: row.ranked,
      stateJson: row.stateJson,
    };
  },
});

export const persistCatchup = internalMutation({
  args: {
    saveId: v.string(),
    guestId: v.string(),
    nowMs: v.number(),
    tickIndex: v.number(),
    status: v.string(),
    stateJson: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const save = await saveByPublicId(ctx, args.saveId);
    if (!save || save.guestId !== args.guestId) {
      throw new Error("catchup_persist_mismatch");
    }
    const state = JSON.parse(args.stateJson) as GameState;
    assertFiniteStocks(state);
    await ctx.db.patch(save._id, {
      tickIndex: args.tickIndex,
      lastTickAt: args.nowMs,
      status: args.status,
      stateJson: args.stateJson,
    });
    const guest = await guestByPublicId(ctx, args.guestId);
    if (guest) {
      await ctx.db.patch(guest._id, { lastSeenAt: args.nowMs });
    }
    return null;
  },
});

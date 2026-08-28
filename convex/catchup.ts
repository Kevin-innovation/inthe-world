import { v } from "convex/values";
import { applyCatchupTicks } from "../packages/db/src/tickLoop";
import {
  parseState,
  planCatchupForSave,
  type CatchupResult,
} from "../packages/db/src/saves";
import { assertFiniteStocks, worldFromPack } from "../packages/sim/src/index";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { loadComingStormPack } from "./comingStormPack";

const catchupResultValidator = v.union(
  v.object({
    httpStatus: v.literal(200),
    body: v.object({
      weeks: v.number(),
      tickIndex: v.number(),
      lastTickAt: v.string(),
      status: v.string(),
      interrupted: v.boolean(),
    }),
  }),
  v.object({
    httpStatus: v.union(
      v.literal(400),
      v.literal(401),
      v.literal(403),
      v.literal(404),
    ),
    body: v.object({ error: v.string() }),
  }),
);

let cachedWorld: ReturnType<typeof worldFromPack> | undefined;

function comingStormWorld() {
  if (!cachedWorld) {
    cachedWorld = worldFromPack(loadComingStormPack());
  }
  return cachedWorld;
}

export const run = action({
  args: {
    saveId: v.string(),
    guestId: v.optional(v.string()),
    body: v.optional(v.any()),
  },
  returns: catchupResultValidator,
  handler: async (ctx, args): Promise<CatchupResult> => {
    const guestId = args.guestId?.trim() || undefined;
    if (!guestId) {
      return { httpStatus: 401, body: { error: "unauthorized" } };
    }

    const save = await ctx.runQuery(internal.saves.loadForCatchup, {
      id: args.saveId,
    });
    if (!save) {
      return { httpStatus: 404, body: { error: "not_found" } };
    }
    if (save.guestId !== guestId) {
      return { httpStatus: 403, body: { error: "forbidden" } };
    }

    const nowMs = Date.now();
    const plan = planCatchupForSave(save, args.body ?? {}, nowMs);
    if (!plan.ok) {
      return { httpStatus: 400, body: { error: plan.error } };
    }

    const loaded = parseState(save.stateJson);
    const applied = applyCatchupTicks(loaded, plan.weeks, comingStormWorld());
    const lastTickAtIso = new Date(nowMs).toISOString();
    applied.state.lastTickAt = lastTickAtIso;
    applied.state.ranked = save.ranked;
    applied.state.saveId = save.id;
    assertFiniteStocks(applied.state);

    await ctx.runMutation(internal.saves.persistCatchup, {
      saveId: save.id,
      guestId,
      nowMs,
      tickIndex: applied.state.tickIndex,
      status: applied.state.status,
      stateJson: JSON.stringify(applied.state),
    });

    return {
      httpStatus: 200,
      body: {
        weeks: plan.weeks,
        tickIndex: applied.state.tickIndex,
        lastTickAt: lastTickAtIso,
        status: applied.state.status,
        interrupted: applied.interrupted,
      },
    };
  },
});

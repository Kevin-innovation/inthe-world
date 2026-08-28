import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const assignmentValidator = v.object({
  id: v.string(),
  guestId: v.string(),
  seasonId: v.string(),
  countryId: v.string(),
  seed: v.number(),
  lore: v.optional(v.string()),
  consumed: v.boolean(),
  createdAt: v.number(),
});

export const savePublicValidator = v.object({
  id: v.string(),
  guestId: v.string(),
  seasonId: v.string(),
  countryId: v.string(),
  seed: v.number(),
  tickIndex: v.number(),
  lastTickAt: v.number(),
  status: v.string(),
  ranked: v.boolean(),
  createdAt: v.number(),
});

export type AssignmentPublic = {
  id: string;
  guestId: string;
  seasonId: string;
  countryId: string;
  seed: number;
  lore?: string;
  consumed: boolean;
  createdAt: number;
};

export type SavePublic = {
  id: string;
  guestId: string;
  seasonId: string;
  countryId: string;
  seed: number;
  tickIndex: number;
  lastTickAt: number;
  status: string;
  ranked: boolean;
  createdAt: number;
};

type DbCtx = QueryCtx | MutationCtx;

export function toAssignmentPublic(row: {
  id: string;
  guestId: string;
  seasonId: string;
  countryId: string;
  seed: number;
  lore?: string;
  consumed: boolean;
  createdAt: number;
}): AssignmentPublic {
  return {
    id: row.id,
    guestId: row.guestId,
    seasonId: row.seasonId,
    countryId: row.countryId,
    seed: row.seed,
    lore: row.lore,
    consumed: row.consumed,
    createdAt: row.createdAt,
  };
}

export function toSavePublic(row: {
  id: string;
  guestId: string;
  seasonId: string;
  countryId: string;
  seed: number;
  tickIndex: number;
  lastTickAt: number;
  status: string;
  ranked: boolean;
  createdAt: number;
}): SavePublic {
  return {
    id: row.id,
    guestId: row.guestId,
    seasonId: row.seasonId,
    countryId: row.countryId,
    seed: row.seed,
    tickIndex: row.tickIndex,
    lastTickAt: row.lastTickAt,
    status: row.status,
    ranked: row.ranked,
    createdAt: row.createdAt,
  };
}

export async function guestByPublicId(ctx: DbCtx, id: string) {
  return await ctx.db
    .query("guests")
    .withIndex("by_public_id", (q) => q.eq("id", id))
    .unique();
}

export async function saveByPublicId(ctx: DbCtx, id: string) {
  return await ctx.db
    .query("saves")
    .withIndex("by_public_id", (q) => q.eq("id", id))
    .unique();
}

export async function findActiveSave(ctx: DbCtx, guestId: string) {
  return await ctx.db
    .query("saves")
    .withIndex("by_guestId_status", (q) =>
      q.eq("guestId", guestId).eq("status", "active"),
    )
    .first();
}

export async function assignmentByPublicId(ctx: DbCtx, id: string) {
  return await ctx.db
    .query("assignments")
    .withIndex("by_public_id", (q) => q.eq("id", id))
    .unique();
}

export async function findOpenAssignment(
  ctx: DbCtx,
  guestId: string,
  seasonId: string,
) {
  const rows = await ctx.db
    .query("assignments")
    .withIndex("by_guestId_seasonId", (q) =>
      q.eq("guestId", guestId).eq("seasonId", seasonId),
    )
    .collect();
  return rows.find((row) => !row.consumed);
}

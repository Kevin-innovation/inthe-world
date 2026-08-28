import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  guests: defineTable({
    id: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_public_id", ["id"]),

  saves: defineTable({
    id: v.string(),
    guestId: v.string(),
    seasonId: v.string(),
    countryId: v.string(),
    seed: v.number(),
    tickIndex: v.number(),
    lastTickAt: v.number(),
    status: v.string(),
    stateJson: v.string(),
    ranked: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_public_id", ["id"])
    .index("by_guestId_status", ["guestId", "status"]),

  assignments: defineTable({
    id: v.string(),
    guestId: v.string(),
    seasonId: v.string(),
    countryId: v.string(),
    seed: v.number(),
    lore: v.optional(v.string()),
    consumed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_public_id", ["id"])
    .index("by_guestId_seasonId", ["guestId", "seasonId"]),

  leaderboardEntries: defineTable({
    saveId: v.string(),
    guestId: v.string(),
    seasonId: v.string(),
    countryId: v.string(),
    score: v.number(),
    tickIndex: v.number(),
    ranked: v.boolean(),
    createdAt: v.number(),
  }).index("by_seasonId", ["seasonId"]),
});

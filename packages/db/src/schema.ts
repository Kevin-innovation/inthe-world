import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guests = sqliteTable("guests", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
});

export const saves = sqliteTable("saves", {
  id: text("id").primaryKey(),
  guestId: text("guest_id")
    .notNull()
    .references(() => guests.id),
  seasonId: text("season_id").notNull(),
  countryId: text("country_id").notNull(),
  seed: integer("seed").notNull(),
  tickIndex: integer("tick_index").notNull(),
  lastTickAt: integer("last_tick_at").notNull(),
  status: text("status").notNull(),
  stateJson: text("state_json").notNull(),
  ranked: integer("ranked", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at").notNull(),
});

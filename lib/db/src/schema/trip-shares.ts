import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tripsTable } from "./trips";

export const tripSharesTable = pgTable("trip_shares", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  sharedWithEmail: text("shared_with_email").notNull(),
  permission: text("permission").notNull().default("view"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripShareSchema = createInsertSchema(tripSharesTable).omit({
  id: true,
  createdAt: true,
}).extend({
  permission: z.enum(["view", "edit"]),
});

export type InsertTripShare = z.infer<typeof insertTripShareSchema>;
export type TripShare = typeof tripSharesTable.$inferSelect;

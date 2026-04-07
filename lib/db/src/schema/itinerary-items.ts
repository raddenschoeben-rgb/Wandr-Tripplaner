import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tripsTable } from "./trips";
import { savedPlacesTable } from "./saved-places";
import { transportModesTable } from "./transport-modes";

export const itineraryItemsTable = pgTable("itinerary_items", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  savedPlaceId: integer("saved_place_id").references(() => savedPlacesTable.id, { onDelete: "set null" }),
  dayNumber: integer("day_number").notNull(),
  position: integer("position").notNull(),
  customName: text("custom_name"),
  note: text("note"),
  estimatedDuration: integer("estimated_duration"),
  estimatedCost: real("estimated_cost"),
  startMinutes: integer("start_minutes"),
  transportModeId: integer("transport_mode_id").references(() => transportModesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertItineraryItemSchema = createInsertSchema(itineraryItemsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertItineraryItem = z.infer<typeof insertItineraryItemSchema>;
export type ItineraryItem = typeof itineraryItemsTable.$inferSelect;

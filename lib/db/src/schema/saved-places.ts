import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savedPlacesTable = pgTable("saved_places", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  category: text("category"),
  note: text("note"),
  estimatedDuration: integer("estimated_duration"),
  estimatedCost: real("estimated_cost"),
  priority: integer("priority"),
  openingHours: text("opening_hours"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSavedPlaceSchema = createInsertSchema(savedPlacesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSavedPlace = z.infer<typeof insertSavedPlaceSchema>;
export type SavedPlace = typeof savedPlacesTable.$inferSelect;

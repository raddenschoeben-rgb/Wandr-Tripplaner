import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const transportModesTable = pgTable("transport_modes", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("🚗"),
  color: text("color").notNull().default("#3b82f6"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

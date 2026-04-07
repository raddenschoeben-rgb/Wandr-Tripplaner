import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { savedPlacesTable } from "./saved-places";
import { tagsTable } from "./tags";

export const placeTagsTable = pgTable(
  "place_tags",
  {
    placeId: integer("place_id")
      .notNull()
      .references(() => savedPlacesTable.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tagsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.tagId] })],
);

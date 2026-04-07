import { inArray, eq } from "drizzle-orm";
import { db, placeTagsTable, tagsTable } from "@workspace/db";

export type TagRow = { id: number; name: string; color: string; createdAt: Date };

export async function getTagsForPlaces(
  placeIds: number[],
): Promise<Map<number, TagRow[]>> {
  const map = new Map<number, TagRow[]>();
  if (placeIds.length === 0) return map;

  const rows = await db
    .select({
      placeId: placeTagsTable.placeId,
      id: tagsTable.id,
      name: tagsTable.name,
      color: tagsTable.color,
      createdAt: tagsTable.createdAt,
    })
    .from(placeTagsTable)
    .innerJoin(tagsTable, eq(placeTagsTable.tagId, tagsTable.id))
    .where(inArray(placeTagsTable.placeId, placeIds));

  for (const row of rows) {
    const existing = map.get(row.placeId) ?? [];
    existing.push({ id: row.id, name: row.name, color: row.color, createdAt: row.createdAt });
    map.set(row.placeId, existing);
  }
  return map;
}

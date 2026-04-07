import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, itineraryItemsTable, savedPlacesTable, transportModesTable } from "@workspace/db";
import {
  CreateItineraryItemBody,
  CreateItineraryItemParams,
  UpdateItineraryItemBody,
  UpdateItineraryItemParams,
  DeleteItineraryItemParams,
  ListItineraryItemsParams,
  ListItineraryItemsResponse,
  ReorderItineraryItemsBody,
  ReorderItineraryItemsParams,
  ReorderItineraryItemsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trips/:tripId/days/:dayNumber/items", async (req, res): Promise<void> => {
  const params = ListItineraryItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const items = await db
    .select({
      id: itineraryItemsTable.id,
      tripId: itineraryItemsTable.tripId,
      savedPlaceId: itineraryItemsTable.savedPlaceId,
      dayNumber: itineraryItemsTable.dayNumber,
      position: itineraryItemsTable.position,
      customName: itineraryItemsTable.customName,
      note: itineraryItemsTable.note,
      estimatedDuration: itineraryItemsTable.estimatedDuration,
      estimatedCost: itineraryItemsTable.estimatedCost,
      startMinutes: itineraryItemsTable.startMinutes,
      place: savedPlacesTable,
    })
    .from(itineraryItemsTable)
    .leftJoin(savedPlacesTable, eq(itineraryItemsTable.savedPlaceId, savedPlacesTable.id))
    .where(
      and(
        eq(itineraryItemsTable.tripId, params.data.tripId),
        eq(itineraryItemsTable.dayNumber, params.data.dayNumber),
      )
    )
    .orderBy(asc(itineraryItemsTable.position));

  res.json(ListItineraryItemsResponse.parse(items));
});

router.post("/trips/:tripId/days/:dayNumber/items", async (req, res): Promise<void> => {
  const params = CreateItineraryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateItineraryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existingItems = await db
    .select({ position: itineraryItemsTable.position })
    .from(itineraryItemsTable)
    .where(
      and(
        eq(itineraryItemsTable.tripId, params.data.tripId),
        eq(itineraryItemsTable.dayNumber, params.data.dayNumber),
      )
    );

  const maxPosition = existingItems.length > 0
    ? Math.max(...existingItems.map((i) => i.position))
    : 0;

  const [item] = await db.insert(itineraryItemsTable).values({
    tripId: params.data.tripId,
    dayNumber: params.data.dayNumber,
    savedPlaceId: parsed.data.savedPlaceId,
    position: maxPosition + 1,
    note: parsed.data.note ?? null,
    estimatedDuration: parsed.data.estimatedDuration ?? null,
    estimatedCost: parsed.data.estimatedCost ?? null,
    startMinutes: parsed.data.startMinutes ?? null,
  }).returning();

  const [itemWithPlace] = await db
    .select({
      id: itineraryItemsTable.id,
      tripId: itineraryItemsTable.tripId,
      savedPlaceId: itineraryItemsTable.savedPlaceId,
      dayNumber: itineraryItemsTable.dayNumber,
      position: itineraryItemsTable.position,
      customName: itineraryItemsTable.customName,
      note: itineraryItemsTable.note,
      estimatedDuration: itineraryItemsTable.estimatedDuration,
      estimatedCost: itineraryItemsTable.estimatedCost,
      startMinutes: itineraryItemsTable.startMinutes,
      transportModeId: itineraryItemsTable.transportModeId,
      transportMode: { id: transportModesTable.id, name: transportModesTable.name, icon: transportModesTable.icon, color: transportModesTable.color },
      place: savedPlacesTable,
    })
    .from(itineraryItemsTable)
    .leftJoin(savedPlacesTable, eq(itineraryItemsTable.savedPlaceId, savedPlacesTable.id))
    .leftJoin(transportModesTable, eq(itineraryItemsTable.transportModeId, transportModesTable.id))
    .where(eq(itineraryItemsTable.id, item.id));

  res.status(201).json({ ...itemWithPlace, transportMode: itemWithPlace?.transportMode?.id ? itemWithPlace.transportMode : null });
});

router.put("/trips/:tripId/days/:dayNumber/items/reorder", async (req, res): Promise<void> => {
  const params = ReorderItineraryItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ReorderItineraryItemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await Promise.all(
    parsed.data.itemIds.map((itemId, index) =>
      db
        .update(itineraryItemsTable)
        .set({ position: index + 1 })
        .where(
          and(
            eq(itineraryItemsTable.id, itemId),
            eq(itineraryItemsTable.tripId, params.data.tripId),
          )
        )
    )
  );

  const rawItems = await db
    .select({
      id: itineraryItemsTable.id,
      tripId: itineraryItemsTable.tripId,
      savedPlaceId: itineraryItemsTable.savedPlaceId,
      dayNumber: itineraryItemsTable.dayNumber,
      position: itineraryItemsTable.position,
      customName: itineraryItemsTable.customName,
      note: itineraryItemsTable.note,
      estimatedDuration: itineraryItemsTable.estimatedDuration,
      estimatedCost: itineraryItemsTable.estimatedCost,
      startMinutes: itineraryItemsTable.startMinutes,
      transportModeId: itineraryItemsTable.transportModeId,
      transportMode: { id: transportModesTable.id, name: transportModesTable.name, icon: transportModesTable.icon, color: transportModesTable.color },
      place: savedPlacesTable,
    })
    .from(itineraryItemsTable)
    .leftJoin(savedPlacesTable, eq(itineraryItemsTable.savedPlaceId, savedPlacesTable.id))
    .leftJoin(transportModesTable, eq(itineraryItemsTable.transportModeId, transportModesTable.id))
    .where(
      and(
        eq(itineraryItemsTable.tripId, params.data.tripId),
        eq(itineraryItemsTable.dayNumber, params.data.dayNumber),
      )
    )
    .orderBy(asc(itineraryItemsTable.position));

  const items = rawItems.map((i) => ({ ...i, transportMode: i.transportMode?.id ? i.transportMode : null }));
  res.json(ReorderItineraryItemsResponse.parse(items));
});

router.put("/trips/:tripId/items/:itemId", async (req, res): Promise<void> => {
  const params = UpdateItineraryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateItineraryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db
    .update(itineraryItemsTable)
    .set(parsed.data)
    .where(
      and(
        eq(itineraryItemsTable.id, params.data.itemId),
        eq(itineraryItemsTable.tripId, params.data.tripId),
      )
    )
    .returning();

  if (!item) {
    res.status(404).json({ error: "Itinerary item not found" });
    return;
  }

  const [itemWithPlace] = await db
    .select({
      id: itineraryItemsTable.id,
      tripId: itineraryItemsTable.tripId,
      savedPlaceId: itineraryItemsTable.savedPlaceId,
      dayNumber: itineraryItemsTable.dayNumber,
      position: itineraryItemsTable.position,
      customName: itineraryItemsTable.customName,
      note: itineraryItemsTable.note,
      estimatedDuration: itineraryItemsTable.estimatedDuration,
      estimatedCost: itineraryItemsTable.estimatedCost,
      startMinutes: itineraryItemsTable.startMinutes,
      transportModeId: itineraryItemsTable.transportModeId,
      transportMode: { id: transportModesTable.id, name: transportModesTable.name, icon: transportModesTable.icon, color: transportModesTable.color },
      place: savedPlacesTable,
    })
    .from(itineraryItemsTable)
    .leftJoin(savedPlacesTable, eq(itineraryItemsTable.savedPlaceId, savedPlacesTable.id))
    .leftJoin(transportModesTable, eq(itineraryItemsTable.transportModeId, transportModesTable.id))
    .where(eq(itineraryItemsTable.id, item.id));

  res.json({ ...itemWithPlace, transportMode: itemWithPlace?.transportMode?.id ? itemWithPlace.transportMode : null });
});

router.delete("/trips/:tripId/items/:itemId", async (req, res): Promise<void> => {
  const params = DeleteItineraryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(itineraryItemsTable)
    .where(
      and(
        eq(itineraryItemsTable.id, params.data.itemId),
        eq(itineraryItemsTable.tripId, params.data.tripId),
      )
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Itinerary item not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;

import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, tripsTable, itineraryItemsTable, savedPlacesTable, transportModesTable, tripSharesTable } from "@workspace/db";
import { getTagsForPlaces } from "../lib/getTagsForPlaces";
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import {
  CreateTripBody,
  UpdateTripBody,
  GetTripParams,
  GetTripResponse,
  UpdateTripParams,
  UpdateTripResponse,
  DeleteTripParams,
  ListTripsResponse,
} from "@workspace/api-zod";
import { differenceInDays, parseISO, addDays, format } from "date-fns";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

router.use(requireAuth);

function getUserEmail(req: Parameters<typeof getAuth>[0]): string {
  const auth = getAuth(req);
  return (auth.sessionClaims as { email?: string } | null)?.email ?? "";
}

router.get("/trips", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const userEmail = getUserEmail(req);

  const ownedTrips = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.userId, userId))
    .orderBy(tripsTable.createdAt);

  let sharedTrips: (typeof tripsTable.$inferSelect)[] = [];
  if (userEmail) {
    const shares = await db
      .select()
      .from(tripSharesTable)
      .where(eq(tripSharesTable.sharedWithEmail, userEmail));
    const sharedTripIds = shares.map((s) => s.tripId);
    if (sharedTripIds.length > 0) {
      sharedTrips = await db
        .select()
        .from(tripsTable)
        .where(inArray(tripsTable.id, sharedTripIds))
        .orderBy(tripsTable.createdAt);
    }
  }

  const ownedIds = new Set(ownedTrips.map((t) => t.id));
  const allTrips = [...ownedTrips, ...sharedTrips.filter((t) => !ownedIds.has(t.id))];
  res.json(ListTripsResponse.parse(allTrips));
});

router.post("/trips", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, startDate, endDate, description } = parsed.data;
  const start = startDate instanceof Date ? startDate : parseISO(startDate as string);
  const end = endDate instanceof Date ? endDate : parseISO(endDate as string);
  const totalDays = Math.max(1, differenceInDays(end, start) + 1);
  const startDateStr = format(start, "yyyy-MM-dd");
  const endDateStr = format(end, "yyyy-MM-dd");

  const [trip] = await db.insert(tripsTable).values({
    userId,
    name,
    startDate: startDateStr,
    endDate: endDateStr,
    description: description ?? null,
    totalDays,
  }).returning();
  res.status(201).json(GetTripResponse.parse({ ...trip, days: [] }));
});

router.get("/trips/:id", async (req, res): Promise<void> => {
  const params = GetTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = getUserId(req);
  const userEmail = getUserEmail(req);

  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, params.data.id));
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  if (trip.userId !== userId) {
    const [share] = await db
      .select()
      .from(tripSharesTable)
      .where(and(eq(tripSharesTable.tripId, trip.id), eq(tripSharesTable.sharedWithEmail, userEmail)));
    if (!share) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

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
      transportMode: {
        id: transportModesTable.id,
        name: transportModesTable.name,
        icon: transportModesTable.icon,
        color: transportModesTable.color,
      },
      place: savedPlacesTable,
    })
    .from(itineraryItemsTable)
    .leftJoin(savedPlacesTable, eq(itineraryItemsTable.savedPlaceId, savedPlacesTable.id))
    .leftJoin(transportModesTable, eq(itineraryItemsTable.transportModeId, transportModesTable.id))
    .where(eq(itineraryItemsTable.tripId, params.data.id))
    .orderBy(itineraryItemsTable.dayNumber, itineraryItemsTable.position);

  const placeIds = rawItems.map((i) => i.place?.id).filter((id): id is number => id != null);
  const tagsMap = await getTagsForPlaces(placeIds);
  const items = rawItems.map((item) => ({
    ...item,
    transportMode: item.transportMode?.id ? item.transportMode : null,
    place: item.place ? { ...item.place, tags: tagsMap.get(item.place.id) ?? [] } : null,
  }));

  const start = parseISO(trip.startDate);
  const days = Array.from({ length: trip.totalDays }, (_, i) => ({
    dayNumber: i + 1,
    date: format(addDays(start, i), "yyyy-MM-dd"),
    items: items.filter((item) => item.dayNumber === i + 1),
  }));

  res.json(GetTripResponse.parse({ ...trip, days }));
});

router.put("/trips/:id", async (req, res): Promise<void> => {
  const params = UpdateTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getUserId(req);
  const userEmail = getUserEmail(req);

  const [existing] = await db.select().from(tripsTable).where(eq(tripsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  if (existing.userId !== userId) {
    const [share] = await db
      .select()
      .from(tripSharesTable)
      .where(and(eq(tripSharesTable.tripId, existing.id), eq(tripSharesTable.sharedWithEmail, userEmail)));
    if (!share || share.permission !== "edit") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startDate && parsed.data.endDate) {
    const start = parsed.data.startDate instanceof Date ? parsed.data.startDate : parseISO(parsed.data.startDate as string);
    const end = parsed.data.endDate instanceof Date ? parsed.data.endDate : parseISO(parsed.data.endDate as string);
    updateData.totalDays = Math.max(1, differenceInDays(end, start) + 1);
    updateData.startDate = format(start, "yyyy-MM-dd");
    updateData.endDate = format(end, "yyyy-MM-dd");
  }

  const [trip] = await db.update(tripsTable).set(updateData).where(eq(tripsTable.id, params.data.id)).returning();
  res.json(UpdateTripResponse.parse(trip));
});

router.delete("/trips/:id", async (req, res): Promise<void> => {
  const params = DeleteTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = getUserId(req);
  const [existing] = await db.select().from(tripsTable).where(eq(tripsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  if (existing.userId !== userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(tripsTable).where(eq(tripsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;

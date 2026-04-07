import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, savedPlacesTable, placeTagsTable } from "@workspace/db";
import {
  CreateSavedPlaceBody,
  UpdateSavedPlaceBody,
  GetSavedPlaceParams,
  GetSavedPlaceResponse,
  UpdateSavedPlaceParams,
  UpdateSavedPlaceResponse,
  DeleteSavedPlaceParams,
  ListSavedPlacesResponse,
} from "@workspace/api-zod";
import { getTagsForPlaces } from "../lib/getTagsForPlaces";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/saved-places", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const places = await db
    .select()
    .from(savedPlacesTable)
    .where(eq(savedPlacesTable.userId, userId))
    .orderBy(savedPlacesTable.createdAt);
  const placeIds = places.map((p) => p.id);
  const tagsMap = await getTagsForPlaces(placeIds);
  const result = places.map((p) => ({ ...p, tags: tagsMap.get(p.id) ?? [] }));
  res.json(ListSavedPlacesResponse.parse(result));
});

router.post("/saved-places", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateSavedPlaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [place] = await db.insert(savedPlacesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(GetSavedPlaceResponse.parse({ ...place, tags: [] }));
});

router.get("/saved-places/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetSavedPlaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [place] = await db
    .select()
    .from(savedPlacesTable)
    .where(and(eq(savedPlacesTable.id, params.data.id), eq(savedPlacesTable.userId, userId)));
  if (!place) {
    res.status(404).json({ error: "Saved place not found" });
    return;
  }
  const tagsMap = await getTagsForPlaces([place.id]);
  res.json(GetSavedPlaceResponse.parse({ ...place, tags: tagsMap.get(place.id) ?? [] }));
});

router.put("/saved-places/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateSavedPlaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSavedPlaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [place] = await db
    .update(savedPlacesTable)
    .set(parsed.data)
    .where(and(eq(savedPlacesTable.id, params.data.id), eq(savedPlacesTable.userId, userId)))
    .returning();
  if (!place) {
    res.status(404).json({ error: "Saved place not found" });
    return;
  }
  const tagsMap = await getTagsForPlaces([place.id]);
  res.json(UpdateSavedPlaceResponse.parse({ ...place, tags: tagsMap.get(place.id) ?? [] }));
});

router.delete("/saved-places/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteSavedPlaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(savedPlacesTable)
    .where(and(eq(savedPlacesTable.id, params.data.id), eq(savedPlacesTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Saved place not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

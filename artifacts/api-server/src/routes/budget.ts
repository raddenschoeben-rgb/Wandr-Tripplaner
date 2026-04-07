import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, budgetItemsTable, itineraryItemsTable, savedPlacesTable } from "@workspace/db";
import {
  CreateBudgetItemBody,
  CreateBudgetItemParams,
  UpdateBudgetItemBody,
  UpdateBudgetItemParams,
  DeleteBudgetItemParams,
  GetTripBudgetParams,
  ListBudgetItemsParams,
  GetTripBudgetResponse,
  ListBudgetItemsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trips/:tripId/budget", async (req, res): Promise<void> => {
  const params = GetTripBudgetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const budgetItems = await db
    .select()
    .from(budgetItemsTable)
    .where(eq(budgetItemsTable.tripId, params.data.tripId));

  const itineraryItems = await db
    .select({
      estimatedCost: itineraryItemsTable.estimatedCost,
      placeEstimatedCost: savedPlacesTable.estimatedCost,
    })
    .from(itineraryItemsTable)
    .leftJoin(savedPlacesTable, eq(itineraryItemsTable.savedPlaceId, savedPlacesTable.id))
    .where(eq(itineraryItemsTable.tripId, params.data.tripId));

  const totalBudget = budgetItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const placesCost = itineraryItems.reduce((sum, item) => sum + (item.estimatedCost ?? item.placeEstimatedCost ?? 0), 0);

  const categoryTotals: Record<string, number> = {};
  for (const item of budgetItems) {
    const cat = item.category ?? "miscellaneous";
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + (item.amount ?? 0);
  }

  const dailyMap: Record<number, number> = {};
  for (const item of budgetItems) {
    if (item.dayNumber != null) {
      dailyMap[item.dayNumber] = (dailyMap[item.dayNumber] ?? 0) + (item.amount ?? 0);
    }
  }
  const dailyTotals = Object.entries(dailyMap).map(([day, total]) => ({
    dayNumber: Number(day),
    total,
  }));

  res.json(
    GetTripBudgetResponse.parse({
      tripId: params.data.tripId,
      totalBudget,
      categoryTotals,
      dailyTotals,
      placesCost,
    })
  );
});

router.get("/trips/:tripId/budget/items", async (req, res): Promise<void> => {
  const params = ListBudgetItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const items = await db
    .select()
    .from(budgetItemsTable)
    .where(eq(budgetItemsTable.tripId, params.data.tripId));
  res.json(ListBudgetItemsResponse.parse(items));
});

router.post("/trips/:tripId/budget/items", async (req, res): Promise<void> => {
  const params = CreateBudgetItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateBudgetItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.insert(budgetItemsTable).values({
    tripId: params.data.tripId,
    ...parsed.data,
  }).returning();
  res.status(201).json(item);
});

router.put("/trips/:tripId/budget/items/:itemId", async (req, res): Promise<void> => {
  const params = UpdateBudgetItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBudgetItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db
    .update(budgetItemsTable)
    .set(parsed.data)
    .where(
      and(
        eq(budgetItemsTable.id, params.data.itemId),
        eq(budgetItemsTable.tripId, params.data.tripId),
      )
    )
    .returning();
  if (!item) {
    res.status(404).json({ error: "Budget item not found" });
    return;
  }
  res.json(item);
});

router.delete("/trips/:tripId/budget/items/:itemId", async (req, res): Promise<void> => {
  const params = DeleteBudgetItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(budgetItemsTable)
    .where(
      and(
        eq(budgetItemsTable.id, params.data.itemId),
        eq(budgetItemsTable.tripId, params.data.tripId),
      )
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Budget item not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

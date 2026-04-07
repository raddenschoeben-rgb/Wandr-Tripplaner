import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, transportModesTable } from "@workspace/db";
import {
  ListTransportModesResponse,
  CreateTransportModeBody,
  CreateTransportModeResponse,
  UpdateTransportModeParams,
  UpdateTransportModeBody,
  UpdateTransportModeResponse,
  DeleteTransportModeParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

const DEFAULT_MODES = [
  { name: "Đi bộ", icon: "🚶", color: "#22c55e" },
  { name: "Xe máy", icon: "🏍️", color: "#f97316" },
  { name: "Ô tô", icon: "🚗", color: "#3b82f6" },
  { name: "Taxi", icon: "🚕", color: "#eab308" },
  { name: "Xe buýt", icon: "🚌", color: "#6366f1" },
  { name: "Tàu hỏa", icon: "🚂", color: "#8b5cf6" },
  { name: "Thuyền", icon: "🚢", color: "#0ea5e9" },
  { name: "Máy bay", icon: "✈️", color: "#ec4899" },
];

async function seedDefaultModesForUser(userId: string) {
  const existing = await db
    .select({ id: transportModesTable.id })
    .from(transportModesTable)
    .where(eq(transportModesTable.userId, userId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(transportModesTable).values(DEFAULT_MODES.map((m) => ({ ...m, userId })));
  }
}

router.get("/transport-modes", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  await seedDefaultModesForUser(userId);
  const modes = await db
    .select()
    .from(transportModesTable)
    .where(eq(transportModesTable.userId, userId))
    .orderBy(transportModesTable.createdAt);
  res.json(ListTransportModesResponse.parse(modes));
});

router.post("/transport-modes", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateTransportModeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [mode] = await db.insert(transportModesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(CreateTransportModeResponse.parse(mode));
});

router.put("/transport-modes/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateTransportModeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTransportModeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [mode] = await db
    .update(transportModesTable)
    .set(parsed.data)
    .where(and(eq(transportModesTable.id, params.data.id), eq(transportModesTable.userId, userId)))
    .returning();
  if (!mode) {
    res.status(404).json({ error: "Transport mode not found" });
    return;
  }
  res.json(UpdateTransportModeResponse.parse(mode));
});

router.delete("/transport-modes/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteTransportModeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(transportModesTable)
    .where(and(eq(transportModesTable.id, params.data.id), eq(transportModesTable.userId, userId)));
  res.status(204).send();
});

export default router;

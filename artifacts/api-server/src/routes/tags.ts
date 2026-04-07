import { Router, type IRouter } from "express";
import { eq, inArray, and } from "drizzle-orm";
import { db, tagsTable, placeTagsTable } from "@workspace/db";
import {
  ListTagsResponse,
  CreateTagBody,
  CreateTagResponse,
  UpdateTagParams,
  UpdateTagBody,
  UpdateTagResponse,
  DeleteTagParams,
  SetPlaceTagsParams,
  SetPlaceTagsBody,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

const DEFAULT_TAGS = [
  { name: "Ẩm thực", icon: "🍜", color: "#f97316" },
  { name: "Cà phê", icon: "☕", color: "#92400e" },
  { name: "Nhà hàng", icon: "🍽️", color: "#ef4444" },
  { name: "Khách sạn", icon: "🏨", color: "#3b82f6" },
  { name: "Di tích", icon: "🏛️", color: "#78716c" },
  { name: "Bảo tàng", icon: "🖼️", color: "#8b5cf6" },
  { name: "Chùa / Đền", icon: "🛕", color: "#f59e0b" },
  { name: "Văn hóa", icon: "🎭", color: "#ec4899" },
  { name: "Mua sắm", icon: "🛍️", color: "#e879f9" },
  { name: "Thiên nhiên", icon: "🌿", color: "#22c55e" },
  { name: "Biển", icon: "🌊", color: "#0ea5e9" },
  { name: "Núi", icon: "⛰️", color: "#64748b" },
  { name: "Công viên", icon: "🌳", color: "#16a34a" },
  { name: "Resort", icon: "🏖️", color: "#06b6d4" },
  { name: "Giải trí", icon: "🎡", color: "#f97316" },
  { name: "Thể thao", icon: "⚽", color: "#10b981" },
  { name: "Spa", icon: "💆", color: "#a855f7" },
  { name: "Bar / Nightlife", icon: "🍸", color: "#6366f1" },
  { name: "Chụp ảnh", icon: "📸", color: "#0284c7" },
  { name: "Đặc sản", icon: "🥘", color: "#dc2626" },
];

async function seedDefaultTagsForUser(userId: string) {
  const existing = await db
    .select({ id: tagsTable.id })
    .from(tagsTable)
    .where(eq(tagsTable.userId, userId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(tagsTable).values(DEFAULT_TAGS.map((t) => ({ ...t, userId })));
  }
}

router.get("/tags", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  await seedDefaultTagsForUser(userId);
  const tags = await db
    .select()
    .from(tagsTable)
    .where(eq(tagsTable.userId, userId))
    .orderBy(tagsTable.createdAt);
  res.json(ListTagsResponse.parse(tags));
});

router.post("/tags", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateTagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tag] = await db.insert(tagsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(CreateTagResponse.parse(tag));
});

router.put("/tags/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateTagParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tag] = await db
    .update(tagsTable)
    .set(parsed.data)
    .where(and(eq(tagsTable.id, params.data.id), eq(tagsTable.userId, userId)))
    .returning();
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  res.json(UpdateTagResponse.parse(tag));
});

router.delete("/tags/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteTagParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(tagsTable)
    .where(and(eq(tagsTable.id, params.data.id), eq(tagsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  res.sendStatus(204);
});

router.put("/saved-places/:id/tags", async (req, res): Promise<void> => {
  const params = SetPlaceTagsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SetPlaceTagsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const placeId = params.data.id;
  await db.delete(placeTagsTable).where(eq(placeTagsTable.placeId, placeId));

  if (parsed.data.tagIds.length > 0) {
    await db.insert(placeTagsTable).values(
      parsed.data.tagIds.map((tagId) => ({ placeId, tagId })),
    );
  }

  res.sendStatus(204);
});

export default router;

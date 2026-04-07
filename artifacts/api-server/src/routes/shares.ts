import { Router } from "express";
import { db, tripSharesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function isValidPermission(p: unknown): p is "view" | "edit" {
  return p === "view" || p === "edit";
}

router.get("/trips/:tripId/shares", async (req, res) => {
  const tripId = Number(req.params.tripId);
  const shares = await db
    .select()
    .from(tripSharesTable)
    .where(eq(tripSharesTable.tripId, tripId))
    .orderBy(tripSharesTable.createdAt);
  res.json(shares);
});

router.post("/trips/:tripId/shares", async (req, res) => {
  const tripId = Number(req.params.tripId);
  const { email, permission } = req.body;
  if (!email || !isValidPermission(permission)) {
    return res.status(400).json({ error: "email and permission (view|edit) required" });
  }
  const existing = await db
    .select()
    .from(tripSharesTable)
    .where(and(eq(tripSharesTable.tripId, tripId), eq(tripSharesTable.sharedWithEmail, email)));
  if (existing.length > 0) {
    const [updated] = await db
      .update(tripSharesTable)
      .set({ permission })
      .where(eq(tripSharesTable.id, existing[0].id))
      .returning();
    return res.json(updated);
  }
  const [share] = await db
    .insert(tripSharesTable)
    .values({ tripId, sharedWithEmail: email, permission })
    .returning();
  res.status(201).json(share);
});

router.patch("/trips/:tripId/shares/:shareId", async (req, res) => {
  const shareId = Number(req.params.shareId);
  const { permission } = req.body;
  if (!isValidPermission(permission)) {
    return res.status(400).json({ error: "permission must be view or edit" });
  }
  const [updated] = await db
    .update(tripSharesTable)
    .set({ permission })
    .where(eq(tripSharesTable.id, shareId))
    .returning();
  if (!updated) return res.status(404).json({ error: "Share not found" });
  res.json(updated);
});

router.delete("/trips/:tripId/shares/:shareId", async (req, res) => {
  const shareId = Number(req.params.shareId);
  await db.delete(tripSharesTable).where(eq(tripSharesTable.id, shareId));
  res.status(204).send();
});

export default router;

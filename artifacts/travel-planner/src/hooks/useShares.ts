import { useState, useCallback } from "react";

export type Permission = "view" | "edit";

export interface TripShare {
  id: number;
  tripId: number;
  sharedWithEmail: string;
  permission: Permission;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export function useShares(tripId: number) {
  const [shares, setShares] = useState<TripShare[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/trips/${tripId}/shares`);
      setShares(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  const addShare = useCallback(async (email: string, permission: Permission) => {
    const data = await apiFetch(`/api/trips/${tripId}/shares`, {
      method: "POST",
      body: JSON.stringify({ email, permission }),
    });
    setShares((prev) => {
      const exists = prev.findIndex((s) => s.id === data.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = data;
        return next;
      }
      return [...prev, data];
    });
    return data;
  }, [tripId]);

  const updateShare = useCallback(async (shareId: number, permission: Permission) => {
    const data = await apiFetch(`/api/trips/${tripId}/shares/${shareId}`, {
      method: "PATCH",
      body: JSON.stringify({ permission }),
    });
    setShares((prev) => prev.map((s) => (s.id === shareId ? data : s)));
  }, [tripId]);

  const removeShare = useCallback(async (shareId: number) => {
    await apiFetch(`/api/trips/${tripId}/shares/${shareId}`, { method: "DELETE" });
    setShares((prev) => prev.filter((s) => s.id !== shareId));
  }, [tripId]);

  return { shares, loading, fetchShares, addShare, updateShare, removeShare };
}

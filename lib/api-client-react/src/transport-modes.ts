import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { TransportMode, CreateTransportModeBody, UpdateTransportModeBody } from "./generated/api.schemas";

const BASE = "/api";

export const getListTransportModesQueryKey = () => ["listTransportModes"] as const;

export function useListTransportModes() {
  return useQuery({
    queryKey: getListTransportModesQueryKey(),
    queryFn: () => customFetch<TransportMode[]>(`${BASE}/transport-modes`, { method: "GET" }),
  });
}

export function useCreateTransportMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTransportModeBody) =>
      customFetch<TransportMode>(`${BASE}/transport-modes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTransportModesQueryKey() });
    },
  });
}

export function useUpdateTransportMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateTransportModeBody }) =>
      customFetch<TransportMode>(`${BASE}/transport-modes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTransportModesQueryKey() });
    },
  });
}

export function useDeleteTransportMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>(`${BASE}/transport-modes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTransportModesQueryKey() });
    },
  });
}

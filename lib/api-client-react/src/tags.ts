import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { Tag, CreateTagBody, UpdateTagBody, SetPlaceTagsBody } from "./generated/api.schemas";

const BASE = "/api";

export const getListTagsQueryKey = () => ["listTags"] as const;

export function useListTags() {
  return useQuery({
    queryKey: getListTagsQueryKey(),
    queryFn: () => customFetch<Tag[]>(`${BASE}/tags`, { method: "GET" }),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTagBody) =>
      customFetch<Tag>(`${BASE}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTagsQueryKey() });
    },
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateTagBody }) =>
      customFetch<Tag>(`${BASE}/tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTagsQueryKey() });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>(`${BASE}/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTagsQueryKey() });
    },
  });
}

export function useSetPlaceTags() {
  return useMutation({
    mutationFn: ({ placeId, tagIds }: { placeId: number; tagIds: number[] }) =>
      customFetch<void>(`${BASE}/saved-places/${placeId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds } satisfies SetPlaceTagsBody),
      }),
  });
}

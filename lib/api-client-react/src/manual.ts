import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions, UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface PinItem {
  id: number;
  requirementId: number;
  committedMinutes: number | null;
  pinnedAt: string;
  title: string;
  status: string;
  priority: string;
  projectId: number;
  projectName: string;
  developerName: string;
  testerNames: string[];
  assigneeNames: string[];
}

export interface PinBody {
  requirementId: number;
  committedMinutes?: number | null;
}

// ── List pins ────────────────────────────────────────────────────────────────

export const getTrackerListPinsQueryKey = () => ["/api/tracker/pins"] as const;

export const trackerListPins = async (options?: RequestInit): Promise<PinItem[]> =>
  customFetch<PinItem[]>("/api/tracker/pins", { ...options, method: "GET" });

export function useTrackerListPins(queryOptions?: UseQueryOptions<PinItem[]>) {
  const key = getTrackerListPinsQueryKey();
  return useQuery<PinItem[]>({
    queryKey: key,
    queryFn: ({ signal }) => trackerListPins({ signal }),
    ...queryOptions,
  });
}

// ── Pin a task ───────────────────────────────────────────────────────────────

export const trackerPinTask = async (body: PinBody, options?: RequestInit): Promise<PinItem> =>
  customFetch<PinItem>("/api/tracker/pins", {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });

export function useTrackerPinTask(
  mutationOptions?: UseMutationOptions<PinItem, unknown, PinBody>,
) {
  const qc = useQueryClient();
  return useMutation<PinItem, unknown, PinBody>({
    mutationFn: (body) => trackerPinTask(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getTrackerListPinsQueryKey() });
    },
    ...mutationOptions,
  });
}

// ── Unpin a task ─────────────────────────────────────────────────────────────

export const trackerUnpinTask = async (requirementId: number, options?: RequestInit): Promise<void> =>
  customFetch<void>(`/api/tracker/pins/${requirementId}`, { ...options, method: "DELETE" });

export function useTrackerUnpinTask(
  mutationOptions?: UseMutationOptions<void, unknown, number>,
) {
  const qc = useQueryClient();
  return useMutation<void, unknown, number>({
    mutationFn: (requirementId) => trackerUnpinTask(requirementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getTrackerListPinsQueryKey() });
    },
    ...mutationOptions,
  });
}

// ── Update committed time ────────────────────────────────────────────────────

export const trackerUpdatePin = async (
  requirementId: number,
  committedMinutes: number | null,
  options?: RequestInit,
): Promise<PinItem> =>
  customFetch<PinItem>(`/api/tracker/pins/${requirementId}`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify({ committedMinutes }),
  });

export function useTrackerUpdatePin(
  mutationOptions?: UseMutationOptions<
    PinItem,
    unknown,
    { requirementId: number; committedMinutes: number | null }
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requirementId, committedMinutes }) =>
      trackerUpdatePin(requirementId, committedMinutes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getTrackerListPinsQueryKey() });
    },
    ...mutationOptions,
  });
}

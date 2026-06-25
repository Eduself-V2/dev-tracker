import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions, UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ── Project References ───────────────────────────────────────────────────────

export type ReferenceVisibilityMode = "admin_only" | "all" | "custom";

export interface ProjectReference {
  id: number;
  projectId: number;
  label: string;
  value: string;
  isSensitive: boolean;
  visibilityMode: ReferenceVisibilityMode;
  visibilityUserIds: number[];
  visibilityRoles: string[];
  createdBy: number;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectReferenceBody {
  label: string;
  value: string;
  isSensitive?: boolean;
  visibilityMode?: ReferenceVisibilityMode;
  visibilityUserIds?: number[];
  visibilityRoles?: string[];
}

export interface UpdateProjectReferenceBody {
  label?: string;
  value?: string;
  isSensitive?: boolean;
  visibilityMode?: ReferenceVisibilityMode;
  visibilityUserIds?: number[];
  visibilityRoles?: string[];
}

export const getTrackerListReferencesQueryKey = (projectId: number) =>
  [`/api/tracker/projects/${projectId}/references`] as const;

export const trackerListReferences = async (
  projectId: number,
  options?: RequestInit,
): Promise<ProjectReference[]> =>
  customFetch<ProjectReference[]>(`/api/tracker/projects/${projectId}/references`, {
    ...options,
    method: "GET",
  });

export function useTrackerListReferences(
  projectId: number,
  queryOptions?: UseQueryOptions<ProjectReference[]>,
) {
  return useQuery<ProjectReference[]>({
    queryKey: getTrackerListReferencesQueryKey(projectId),
    queryFn: ({ signal }) => trackerListReferences(projectId, { signal }),
    ...queryOptions,
  });
}

export const trackerCreateReference = async (
  projectId: number,
  body: CreateProjectReferenceBody,
  options?: RequestInit,
): Promise<ProjectReference> =>
  customFetch<ProjectReference>(`/api/tracker/projects/${projectId}/references`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });

export function useTrackerCreateReference(
  projectId: number,
  mutationOptions?: UseMutationOptions<ProjectReference, unknown, CreateProjectReferenceBody>,
) {
  const qc = useQueryClient();
  return useMutation<ProjectReference, unknown, CreateProjectReferenceBody>({
    mutationFn: (body) => trackerCreateReference(projectId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getTrackerListReferencesQueryKey(projectId) });
    },
    ...mutationOptions,
  });
}

export const trackerUpdateReference = async (
  projectId: number,
  refId: number,
  body: UpdateProjectReferenceBody,
  options?: RequestInit,
): Promise<ProjectReference> =>
  customFetch<ProjectReference>(`/api/tracker/projects/${projectId}/references/${refId}`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });

export function useTrackerUpdateReference(
  projectId: number,
  mutationOptions?: UseMutationOptions<
    ProjectReference,
    unknown,
    { refId: number; body: UpdateProjectReferenceBody }
  >,
) {
  const qc = useQueryClient();
  return useMutation<ProjectReference, unknown, { refId: number; body: UpdateProjectReferenceBody }>({
    mutationFn: ({ refId, body }) => trackerUpdateReference(projectId, refId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getTrackerListReferencesQueryKey(projectId) });
    },
    ...mutationOptions,
  });
}

export const trackerDeleteReference = async (
  projectId: number,
  refId: number,
  options?: RequestInit,
): Promise<void> =>
  customFetch<void>(`/api/tracker/projects/${projectId}/references/${refId}`, {
    ...options,
    method: "DELETE",
  });

export function useTrackerDeleteReference(
  projectId: number,
  mutationOptions?: UseMutationOptions<void, unknown, number>,
) {
  const qc = useQueryClient();
  return useMutation<void, unknown, number>({
    mutationFn: (refId) => trackerDeleteReference(projectId, refId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getTrackerListReferencesQueryKey(projectId) });
    },
    ...mutationOptions,
  });
}

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

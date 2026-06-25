import * as zod from "zod";

export const TrackerPinBody = zod.object({
  requirementId: zod.number().int().positive(),
  committedMinutes: zod.number().int().positive().nullable().optional(),
});

export const TrackerPinItem = zod.object({
  id: zod.number(),
  requirementId: zod.number(),
  committedMinutes: zod.number().nullable(),
  pinnedAt: zod.coerce.date(),
  title: zod.string(),
  status: zod.string(),
  priority: zod.string(),
  projectName: zod.string(),
  projectId: zod.number(),
  developerName: zod.string(),
  testerNames: zod.array(zod.string()),
  assigneeNames: zod.array(zod.string()),
});

export const TrackerListPinsResponse = zod.array(TrackerPinItem);

export type TrackerPinBodyType = zod.infer<typeof TrackerPinBody>;
export type TrackerPinItemType = zod.infer<typeof TrackerPinItem>;

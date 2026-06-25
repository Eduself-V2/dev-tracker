import { Router, type IRouter } from "express";
import {
  trackerPool,
  type ProjectReferenceRow,
  type ReferenceVisibilityMode,
} from "../../lib/trackerDb";
import { requireTrackerRole } from "../../middlewares/requireTrackerAuth";

const router: IRouter = Router({ mergeParams: true });

const adminOnly = requireTrackerRole("admin");

function serialize(r: ProjectReferenceRow) {
  return {
    id: r.id,
    projectId: r.project_id,
    label: r.label,
    value: r.value,
    isSensitive: Boolean(r.is_sensitive),
    visibilityMode: r.visibility_mode,
    visibilityUserIds: r.vis_user_ids
      ? r.vis_user_ids.split(",").map(Number)
      : [],
    visibilityRoles: r.vis_roles ? r.vis_roles.split(",") : [],
    createdBy: r.created_by,
    creatorName: r.creator_name,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const SELECT_REFS = `
  SELECT r.*,
    u.name AS creator_name,
    GROUP_CONCAT(DISTINCT IF(v.user_id IS NOT NULL, v.user_id, NULL)) AS vis_user_ids,
    GROUP_CONCAT(DISTINCT v.role) AS vis_roles
  FROM project_references r
  JOIN users u ON u.id = r.created_by
  LEFT JOIN project_reference_visibility v ON v.reference_id = r.id
`;

router.get("/", async (req, res, next) => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    if (isNaN(projectId)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const me = req.trackerUser!;

    let rows: ProjectReferenceRow[];

    if (me.role === "admin") {
      const [result] = await trackerPool.query(
        `${SELECT_REFS}
         WHERE r.project_id = ?
         GROUP BY r.id
         ORDER BY r.created_at ASC`,
        [projectId],
      );
      rows = result as ProjectReferenceRow[];
    } else {
      const [result] = await trackerPool.query(
        `${SELECT_REFS}
         WHERE r.project_id = ?
           AND (
             r.visibility_mode = 'all'
             OR (r.visibility_mode = 'custom' AND EXISTS (
               SELECT 1 FROM project_reference_visibility v2
               WHERE v2.reference_id = r.id
                 AND (v2.user_id = ? OR v2.role = ?)
             ))
           )
         GROUP BY r.id
         ORDER BY r.created_at ASC`,
        [projectId, me.id, me.role],
      );
      rows = result as ProjectReferenceRow[];
    }

    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

async function applyVisibilityRules(
  referenceId: number,
  mode: ReferenceVisibilityMode,
  userIds: number[],
  roles: string[],
) {
  await trackerPool.query(
    "DELETE FROM project_reference_visibility WHERE reference_id = ?",
    [referenceId],
  );
  if (mode === "custom") {
    const inserts: [number, number | null, string | null][] = [
      ...userIds.map((uid): [number, number, null] => [referenceId, uid, null]),
      ...roles
        .filter((r) => r === "developer" || r === "tester")
        .map((role): [number, null, string] => [referenceId, null, role]),
    ];
    for (const [refId, userId, role] of inserts) {
      await trackerPool.query(
        "INSERT INTO project_reference_visibility (reference_id, user_id, role) VALUES (?, ?, ?)",
        [refId, userId, role],
      );
    }
  }
}

router.post("/", adminOnly, async (req, res, next) => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    if (isNaN(projectId)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const { label, value, isSensitive, visibilityMode, visibilityUserIds, visibilityRoles } =
      req.body ?? {};

    if (!label || typeof label !== "string" || label.trim().length === 0) {
      res.status(400).json({ error: "Label is required" });
      return;
    }
    if (value === undefined || value === null || String(value).trim().length === 0) {
      res.status(400).json({ error: "Value is required" });
      return;
    }

    const mode: ReferenceVisibilityMode =
      visibilityMode === "all" || visibilityMode === "custom" ? visibilityMode : "admin_only";
    const me = req.trackerUser!;

    const [result] = await trackerPool.query(
      `INSERT INTO project_references (project_id, label, value, is_sensitive, visibility_mode, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId, label.trim(), String(value).trim(), isSensitive ? 1 : 0, mode, me.id],
    );
    const insertId = (result as { insertId: number }).insertId;

    await applyVisibilityRules(
      insertId,
      mode,
      Array.isArray(visibilityUserIds) ? visibilityUserIds : [],
      Array.isArray(visibilityRoles) ? visibilityRoles : [],
    );

    const [rows] = await trackerPool.query(
      `${SELECT_REFS} WHERE r.id = ? GROUP BY r.id`,
      [insertId],
    );
    res.status(201).json(serialize((rows as ProjectReferenceRow[])[0]));
  } catch (err) {
    next(err);
  }
});

router.patch("/:refId", adminOnly, async (req, res, next) => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    const refId = parseInt(String(req.params.refId));
    if (isNaN(projectId) || isNaN(refId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { label, value, isSensitive, visibilityMode, visibilityUserIds, visibilityRoles } =
      req.body ?? {};

    const fields: string[] = [];
    const values: unknown[] = [];

    if (label !== undefined) {
      fields.push("label = ?");
      values.push(String(label).trim());
    }
    if (value !== undefined) {
      fields.push("value = ?");
      values.push(String(value).trim());
    }
    if (isSensitive !== undefined) {
      fields.push("is_sensitive = ?");
      values.push(isSensitive ? 1 : 0);
    }
    if (visibilityMode !== undefined) {
      const mode: ReferenceVisibilityMode =
        visibilityMode === "all" || visibilityMode === "custom" ? visibilityMode : "admin_only";
      fields.push("visibility_mode = ?");
      values.push(mode);
    }

    if (fields.length > 0) {
      values.push(refId, projectId);
      const [result] = await trackerPool.query(
        `UPDATE project_references SET ${fields.join(", ")} WHERE id = ? AND project_id = ?`,
        values,
      );
      if ((result as { affectedRows: number }).affectedRows === 0) {
        res.status(404).json({ error: "Reference not found" });
        return;
      }
    }

    if (visibilityMode !== undefined || visibilityUserIds !== undefined || visibilityRoles !== undefined) {
      const [current] = await trackerPool.query(
        "SELECT visibility_mode FROM project_references WHERE id = ?",
        [refId],
      );
      const currentMode = (current as { visibility_mode: ReferenceVisibilityMode }[])[0]
        ?.visibility_mode ?? "admin_only";
      await applyVisibilityRules(
        refId,
        currentMode,
        Array.isArray(visibilityUserIds) ? visibilityUserIds : [],
        Array.isArray(visibilityRoles) ? visibilityRoles : [],
      );
    }

    const [rows] = await trackerPool.query(
      `${SELECT_REFS} WHERE r.id = ? GROUP BY r.id`,
      [refId],
    );
    if (!(rows as ProjectReferenceRow[]).length) {
      res.status(404).json({ error: "Reference not found" });
      return;
    }
    res.json(serialize((rows as ProjectReferenceRow[])[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:refId", adminOnly, async (req, res, next) => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    const refId = parseInt(String(req.params.refId));
    if (isNaN(projectId) || isNaN(refId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [result] = await trackerPool.query(
      "DELETE FROM project_references WHERE id = ? AND project_id = ?",
      [refId, projectId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      res.status(404).json({ error: "Reference not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;

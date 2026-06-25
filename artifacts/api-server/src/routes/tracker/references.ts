import { Router, type IRouter } from "express";
import { trackerPool, type ProjectReferenceRow } from "../../lib/trackerDb";
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
    createdBy: r.created_by,
    creatorName: r.creator_name,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

router.get("/", async (req, res, next) => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    if (isNaN(projectId)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const [rows] = await trackerPool.query(
      `SELECT r.*, u.name AS creator_name
       FROM project_references r
       JOIN users u ON u.id = r.created_by
       WHERE r.project_id = ?
       ORDER BY r.created_at ASC`,
      [projectId],
    );
    res.json((rows as ProjectReferenceRow[]).map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", adminOnly, async (req, res, next) => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    if (isNaN(projectId)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const { label, value, isSensitive } = req.body ?? {};
    if (!label || typeof label !== "string" || label.trim().length === 0) {
      res.status(400).json({ error: "Label is required" });
      return;
    }
    if (value === undefined || value === null || String(value).trim().length === 0) {
      res.status(400).json({ error: "Value is required" });
      return;
    }
    const me = req.trackerUser!;
    const [result] = await trackerPool.query(
      `INSERT INTO project_references (project_id, label, value, is_sensitive, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [projectId, label.trim(), String(value).trim(), isSensitive ? 1 : 0, me.id],
    );
    const insertId = (result as { insertId: number }).insertId;
    const [rows] = await trackerPool.query(
      `SELECT r.*, u.name AS creator_name
       FROM project_references r
       JOIN users u ON u.id = r.created_by
       WHERE r.id = ?`,
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
    const { label, value, isSensitive } = req.body ?? {};
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
    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    values.push(refId, projectId);
    const [result] = await trackerPool.query(
      `UPDATE project_references SET ${fields.join(", ")} WHERE id = ? AND project_id = ?`,
      values,
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      res.status(404).json({ error: "Reference not found" });
      return;
    }
    const [rows] = await trackerPool.query(
      `SELECT r.*, u.name AS creator_name
       FROM project_references r
       JOIN users u ON u.id = r.created_by
       WHERE r.id = ?`,
      [refId],
    );
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

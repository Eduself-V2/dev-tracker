import { Router, type IRouter } from "express";
import { trackerPool, type ProjectRow } from "../../lib/trackerDb";
import { requireTrackerRole } from "../../middlewares/requireTrackerAuth";

const router: IRouter = Router();

// List and get are readable by all authenticated users (needed for filtering)
// Mutations are admin-only
const adminOnly = requireTrackerRole("admin");

function serialize(p: ProjectRow) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    createdAt: p.created_at.toISOString(),
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await trackerPool.query(
      "SELECT id, name, description, created_at FROM projects ORDER BY created_at DESC",
    );
    res.json((rows as ProjectRow[]).map(serialize));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const [rows] = await trackerPool.query(
      "SELECT id, name, description, created_at FROM projects WHERE id = ?",
      [id],
    );
    const project = (rows as ProjectRow[])[0];
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(serialize(project));
  } catch (err) {
    next(err);
  }
});

router.post("/", adminOnly, async (req, res, next) => {
  try {
    const { name, description } = req.body ?? {};
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Project name is required" });
      return;
    }
    const [result] = await trackerPool.query(
      "INSERT INTO projects (name, description) VALUES (?, ?)",
      [name.trim(), description ?? null],
    );
    const insertId = (result as { insertId: number }).insertId;
    const [rows] = await trackerPool.query(
      "SELECT id, name, description, created_at FROM projects WHERE id = ?",
      [insertId],
    );
    res.status(201).json(serialize((rows as ProjectRow[])[0]));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", adminOnly, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const { name, description } = req.body ?? {};
    const fields: string[] = [];
    const values: unknown[] = [];
    if (name !== undefined) {
      fields.push("name = ?");
      values.push(name);
    }
    if (description !== undefined) {
      fields.push("description = ?");
      values.push(description ?? null);
    }
    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    values.push(id);
    await trackerPool.query(
      `UPDATE projects SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );
    const [rows] = await trackerPool.query(
      "SELECT id, name, description, created_at FROM projects WHERE id = ?",
      [id],
    );
    const project = (rows as ProjectRow[])[0];
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(serialize(project));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", adminOnly, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const [result] = await trackerPool.query(
      "DELETE FROM projects WHERE id = ?",
      [id],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "ER_ROW_IS_REFERENCED_2") {
      res.status(409).json({
        error: "Cannot delete project — it still has requirements assigned",
      });
      return;
    }
    next(err);
  }
});

export default router;

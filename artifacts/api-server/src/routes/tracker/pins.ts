import { Router, type IRouter } from "express";
import { TrackerPinBody } from "@workspace/api-zod";
import { trackerPool } from "../../lib/trackerDb";

const router: IRouter = Router();

const PIN_LIST_SQL = `
  SELECT
    tp.id,
    tp.committed_minutes,
    tp.pinned_at,
    r.id AS requirement_id,
    r.title,
    r.status,
    r.priority,
    r.project_id,
    p.name AS project_name,
    d.name AS developer_name,
    GROUP_CONCAT(DISTINCT t.name ORDER BY rt.tester_id SEPARATOR ',') AS tester_names,
    GROUP_CONCAT(DISTINCT au.name ORDER BY ra.id SEPARATOR ',') AS assignee_names
  FROM task_pins tp
  JOIN requirements r ON r.id = tp.requirement_id
  JOIN users d ON d.id = r.developer_id
  JOIN projects p ON p.id = r.project_id
  LEFT JOIN requirement_testers rt ON rt.requirement_id = r.id
  LEFT JOIN users t ON t.id = rt.tester_id
  LEFT JOIN requirement_assignees ra ON ra.requirement_id = r.id
  LEFT JOIN users au ON au.id = ra.user_id
`;

function serializePin(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    requirementId: row.requirement_id as number,
    committedMinutes: (row.committed_minutes as number | null) ?? null,
    pinnedAt: (row.pinned_at as Date).toISOString(),
    title: row.title as string,
    status: row.status as string,
    priority: row.priority as string,
    projectId: row.project_id as number,
    projectName: row.project_name as string,
    developerName: row.developer_name as string,
    testerNames: row.tester_names
      ? (row.tester_names as string).split(",").filter(Boolean)
      : [],
    assigneeNames: row.assignee_names
      ? (row.assignee_names as string).split(",").filter(Boolean)
      : [],
  };
}

// GET /tracker/pins — list my pins
router.get("/", async (req, res, next) => {
  try {
    const me = req.trackerUser!;
    const [rows] = await trackerPool.query(
      `${PIN_LIST_SQL} WHERE tp.user_id = ? GROUP BY tp.id, r.id ORDER BY tp.pinned_at DESC`,
      [me.id],
    );
    res.json((rows as Record<string, unknown>[]).map(serializePin));
  } catch (err) {
    next(err);
  }
});

// POST /tracker/pins — pin a task
router.post("/", async (req, res, next) => {
  try {
    const me = req.trackerUser!;
    const body = TrackerPinBody.parse(req.body);

    const [reqRows] = await trackerPool.query(
      "SELECT id FROM requirements WHERE id = ?",
      [body.requirementId],
    );
    if ((reqRows as unknown[]).length === 0) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }

    await trackerPool.query(
      `INSERT INTO task_pins (user_id, requirement_id, committed_minutes)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE committed_minutes = VALUES(committed_minutes), pinned_at = pinned_at`,
      [me.id, body.requirementId, body.committedMinutes ?? null],
    );

    const [rows] = await trackerPool.query(
      `${PIN_LIST_SQL} WHERE tp.user_id = ? AND tp.requirement_id = ? GROUP BY tp.id, r.id`,
      [me.id, body.requirementId],
    );
    res.status(201).json(serializePin((rows as Record<string, unknown>[])[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /tracker/pins/:requirementId — update committed time
router.patch("/:requirementId", async (req, res, next) => {
  try {
    const me = req.trackerUser!;
    const requirementId = parseInt(req.params.requirementId);
    if (isNaN(requirementId)) {
      res.status(400).json({ error: "Invalid requirement id" });
      return;
    }

    const rawMinutes = req.body?.committedMinutes;
    const body = {
      committedMinutes: rawMinutes === null || rawMinutes === undefined ? null : Number(rawMinutes),
    };

    const [existing] = await trackerPool.query(
      "SELECT id FROM task_pins WHERE user_id = ? AND requirement_id = ?",
      [me.id, requirementId],
    );
    if ((existing as unknown[]).length === 0) {
      res.status(404).json({ error: "Pin not found" });
      return;
    }

    await trackerPool.query(
      "UPDATE task_pins SET committed_minutes = ? WHERE user_id = ? AND requirement_id = ?",
      [body.committedMinutes, me.id, requirementId],
    );

    const [rows] = await trackerPool.query(
      `${PIN_LIST_SQL} WHERE tp.user_id = ? AND tp.requirement_id = ? GROUP BY tp.id, r.id`,
      [me.id, requirementId],
    );
    res.json(serializePin((rows as Record<string, unknown>[])[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /tracker/pins/:requirementId — unpin
router.delete("/:requirementId", async (req, res, next) => {
  try {
    const me = req.trackerUser!;
    const requirementId = parseInt(req.params.requirementId);
    if (isNaN(requirementId)) {
      res.status(400).json({ error: "Invalid requirement id" });
      return;
    }

    await trackerPool.query(
      "DELETE FROM task_pins WHERE user_id = ? AND requirement_id = ?",
      [me.id, requirementId],
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

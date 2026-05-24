import { Router, type IRouter } from "express";
import {
  TrackerListRequirementsQueryParams,
  TrackerCreateRequirementBody,
  TrackerGetRequirementParams,
  TrackerUpdateRequirementParams,
  TrackerUpdateRequirementBody,
  TrackerTransitionRequirementParams,
  TrackerTransitionRequirementBody,
  TrackerAddCommentParams,
  TrackerAddCommentBody,
} from "@workspace/api-zod";
import {
  trackerPool,
  type RequirementListRow,
  type EventRow,
  type CommentRow,
  type RequirementRow,
  type TrackerRole,
} from "../../lib/trackerDb";

const router: IRouter = Router();

type Status = RequirementRow["status"];

const ALLOWED_TRANSITIONS: Record<TrackerRole, Record<Status, Status[]>> = {
  admin: {
    open: ["in_testing", "needs_fix", "confirmed", "pushed_to_production"],
    in_testing: ["open", "needs_fix", "confirmed", "pushed_to_production"],
    needs_fix: ["open", "in_testing", "confirmed", "pushed_to_production"],
    confirmed: ["open", "in_testing", "needs_fix", "pushed_to_production"],
    pushed_to_production: ["open", "in_testing", "needs_fix", "confirmed"],
  },
  developer: {
    open: ["in_testing"],
    in_testing: [],
    needs_fix: ["in_testing"],
    confirmed: ["pushed_to_production"],
    pushed_to_production: [],
  },
  tester: {
    open: [],
    in_testing: ["confirmed", "needs_fix"],
    needs_fix: [],
    confirmed: [],
    pushed_to_production: [],
  },
};

function serializeRequirementListRow(r: RequirementListRow) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    developerId: r.developer_id,
    developerName: r.developer_name,
    testerId: r.tester_id,
    testerName: r.tester_name,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    projectId: r.project_id,
    projectName: r.project_name,
    testCycles: r.test_cycles,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function serializeEvent(e: EventRow) {
  return {
    id: e.id,
    requirementId: e.requirement_id,
    kind: e.kind,
    fromStatus: e.from_status,
    toStatus: e.to_status,
    note: e.note,
    actorId: e.actor_id,
    actorName: e.actor_name,
    createdAt: e.created_at.toISOString(),
  };
}

function serializeComment(c: CommentRow) {
  return {
    id: c.id,
    requirementId: c.requirement_id,
    body: c.body,
    authorId: c.author_id,
    authorName: c.author_name,
    authorRole: c.author_role,
    createdAt: c.created_at.toISOString(),
  };
}

const REQ_LIST_SQL = `
  SELECT r.*, d.name AS developer_name, t.name AS tester_name, a.name AS assignee_name, p.name AS project_name
  FROM requirements r
  JOIN users d ON d.id = r.developer_id
  LEFT JOIN users t ON t.id = r.tester_id
  LEFT JOIN users a ON a.id = r.assignee_id
  JOIN projects p ON p.id = r.project_id
`;

router.get("/", async (req, res, next) => {
  try {
    const params = TrackerListRequirementsQueryParams.parse(req.query);
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.projectId) {
      conditions.push("r.project_id = ?");
      values.push(params.projectId);
    }
    if (params.status && params.status !== "all") {
      conditions.push("r.status = ?");
      values.push(params.status);
    }
    if (params.search && params.search.trim().length > 0) {
      conditions.push("(r.title LIKE ? OR r.description LIKE ?)");
      const term = `%${params.search.trim()}%`;
      values.push(term, term);
    }
    if (params.mine) {
      const me = req.trackerUser!;
      conditions.push("r.assignee_id = ?");
      values.push(me.id);
    }
    if (!params.mine && req.trackerUser!.role !== "admin") {
      const me = req.trackerUser!;
      conditions.push("r.assignee_id = ?");
      values.push(me.id);
    }
    const where =
      conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await trackerPool.query(
      `${REQ_LIST_SQL}${where} ORDER BY r.updated_at DESC`,
      values,
    );
    res.json((rows as RequirementListRow[]).map(serializeRequirementListRow));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const me = req.trackerUser!;
    if (me.role !== "developer" && me.role !== "admin") {
      res.status(403).json({ error: "Only developers can create requirements" });
      return;
    }
    const body = TrackerCreateRequirementBody.parse(req.body);

    if (body.testerId !== undefined && body.testerId !== null) {
      const [trows] = await trackerPool.query(
        "SELECT id, role FROM users WHERE id = ?",
        [body.testerId],
      );
      const tester = (trows as Array<{ id: number; role: TrackerRole }>)[0];
      if (!tester || tester.role !== "tester") {
        res.status(400).json({ error: "Assigned user is not a tester" });
        return;
      }
    }

    if (body.assigneeId !== undefined && body.assigneeId !== null) {
      const [arows] = await trackerPool.query(
        "SELECT id FROM users WHERE id = ?",
        [body.assigneeId],
      );
      if ((arows as Array<{ id: number }>).length === 0) {
        res.status(400).json({ error: "Assignee not found" });
        return;
      }
    }

    const [insertResult] = await trackerPool.query(
      "INSERT INTO requirements (title, description, priority, developer_id, tester_id, assignee_id, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        body.title,
        body.description ?? null,
        body.priority ?? "medium",
        me.id,
        body.testerId ?? null,
        body.assigneeId ?? me.id,
        body.projectId,
      ],
    );
    const insertId = (insertResult as { insertId: number }).insertId;
    await trackerPool.query(
      "INSERT INTO requirement_events (requirement_id, kind, to_status, actor_id, note) VALUES (?, 'created', 'open', ?, ?)",
      [insertId, me.id, body.testerId ? `Assigned tester at creation` : null],
    );

    const [rows] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ?`,
      [insertId],
    );
    const row = (rows as RequirementListRow[])[0];
    res.status(201).json(serializeRequirementListRow(row));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = TrackerGetRequirementParams.parse(req.params);
    const [rrows] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ?`,
      [id],
    );
    const row = (rrows as RequirementListRow[])[0];
    if (!row) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    const [erows] = await trackerPool.query(
      `SELECT e.*, u.name AS actor_name FROM requirement_events e
       JOIN users u ON u.id = e.actor_id
       WHERE e.requirement_id = ?
       ORDER BY e.created_at ASC, e.id ASC`,
      [id],
    );
    const [crows] = await trackerPool.query(
      `SELECT c.*, u.name AS author_name, u.role AS author_role
       FROM requirement_comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.requirement_id = ?
       ORDER BY c.created_at ASC, c.id ASC`,
      [id],
    );
    res.json({
      requirement: serializeRequirementListRow(row),
      events: (erows as EventRow[]).map(serializeEvent),
      comments: (crows as CommentRow[]).map(serializeComment),
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = TrackerUpdateRequirementParams.parse(req.params);
    const body = TrackerUpdateRequirementBody.parse(req.body);
    const me = req.trackerUser!;

    const [existRows] = await trackerPool.query(
      "SELECT * FROM requirements WHERE id = ?",
      [id],
    );
    const existing = (existRows as RequirementRow[])[0];
    if (!existing) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    if (
      me.role !== "admin" &&
      !(me.role === "developer" && existing.developer_id === me.id)
    ) {
      res
        .status(403)
        .json({ error: "Only the owning developer or an admin can edit" });
      return;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.title !== undefined) {
      fields.push("title = ?");
      values.push(body.title);
    }
    if (body.description !== undefined) {
      fields.push("description = ?");
      values.push(body.description ?? null);
    }
    if (body.priority !== undefined) {
      fields.push("priority = ?");
      values.push(body.priority);
    }
    if (body.testerId !== undefined) {
      if (body.testerId !== null) {
        const [trows] = await trackerPool.query(
          "SELECT id, role FROM users WHERE id = ?",
          [body.testerId],
        );
        const tester = (trows as Array<{ id: number; role: TrackerRole }>)[0];
        if (!tester || tester.role !== "tester") {
          res.status(400).json({ error: "Assigned user is not a tester" });
          return;
        }
      }
      fields.push("tester_id = ?");
      values.push(body.testerId);
    }
    if (body.assigneeId !== undefined) {
      if (body.assigneeId !== null) {
        const [arows] = await trackerPool.query(
          "SELECT id FROM users WHERE id = ?",
          [body.assigneeId],
        );
        if ((arows as Array<{ id: number }>).length === 0) {
          res.status(400).json({ error: "Assignee not found" });
          return;
        }
      }
      fields.push("assignee_id = ?");
      values.push(body.assigneeId);
    }
    if (body.projectId !== undefined) {
      const [prows] = await trackerPool.query(
        "SELECT id FROM projects WHERE id = ?",
        [body.projectId],
      );
      if ((prows as Array<{ id: number }>).length === 0) {
        res.status(400).json({ error: "Project not found" });
        return;
      }
      fields.push("project_id = ?");
      values.push(body.projectId);
    }

    if (fields.length > 0) {
      values.push(id);
      await trackerPool.query(
        `UPDATE requirements SET ${fields.join(", ")} WHERE id = ?`,
        values,
      );
      if (body.testerId !== undefined) {
        await trackerPool.query(
          "INSERT INTO requirement_events (requirement_id, kind, actor_id, note) VALUES (?, 'assigned', ?, ?)",
          [id, me.id, body.testerId === null ? "Tester unassigned" : "Tester assigned"],
        );
      }
      if (body.assigneeId !== undefined) {
        await trackerPool.query(
          "INSERT INTO requirement_events (requirement_id, kind, actor_id, note) VALUES (?, 'assigned', ?, ?)",
          [id, me.id, body.assigneeId === null ? "Assignee unassigned" : "Assignee changed"],
        );
      }
    }

    const [rows] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ?`,
      [id],
    );
    res.json(
      serializeRequirementListRow((rows as RequirementListRow[])[0]),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/:id/transition", async (req, res, next) => {
  try {
    const { id } = TrackerTransitionRequirementParams.parse(req.params);
    const body = TrackerTransitionRequirementBody.parse(req.body);
    const me = req.trackerUser!;

    const [existRows] = await trackerPool.query(
      "SELECT * FROM requirements WHERE id = ?",
      [id],
    );
    const existing = (existRows as RequirementRow[])[0];
    if (!existing) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }

    const allowed = ALLOWED_TRANSITIONS[me.role][existing.status] ?? [];
    if (!allowed.includes(body.toStatus)) {
      res.status(403).json({
        error: `Your role (${me.role}) cannot move a ${existing.status} requirement to ${body.toStatus}`,
      });
      return;
    }

    if (
      me.role === "tester" &&
      existing.tester_id !== null &&
      existing.tester_id !== me.id
    ) {
      res
        .status(403)
        .json({ error: "Only the assigned tester can change this status" });
      return;
    }

    const incrementCycle = body.toStatus === "in_testing";

    const setClauses = ["status = ?"];
    const setValues: unknown[] = [body.toStatus];
    if (incrementCycle) {
      setClauses.push("test_cycles = test_cycles + 1");
    }
    setValues.push(id);

    await trackerPool.query(
      `UPDATE requirements SET ${setClauses.join(", ")} WHERE id = ?`,
      setValues,
    );
    await trackerPool.query(
      "INSERT INTO requirement_events (requirement_id, kind, from_status, to_status, note, actor_id) VALUES (?, 'transitioned', ?, ?, ?, ?)",
      [id, existing.status, body.toStatus, body.note ?? null, me.id],
    );

    const [rows] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ?`,
      [id],
    );
    res.json(
      serializeRequirementListRow((rows as RequirementListRow[])[0]),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/:id/comments", async (req, res, next) => {
  try {
    const { id } = TrackerAddCommentParams.parse(req.params);
    const body = TrackerAddCommentBody.parse(req.body);
    const me = req.trackerUser!;

    const [existRows] = await trackerPool.query(
      "SELECT id FROM requirements WHERE id = ?",
      [id],
    );
    if ((existRows as Array<{ id: number }>).length === 0) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }

    const [insertResult] = await trackerPool.query(
      "INSERT INTO requirement_comments (requirement_id, body, author_id) VALUES (?, ?, ?)",
      [id, body.body, me.id],
    );
    await trackerPool.query(
      "INSERT INTO requirement_events (requirement_id, kind, actor_id, note) VALUES (?, 'comment', ?, ?)",
      [id, me.id, body.body.slice(0, 280)],
    );
    const insertId = (insertResult as { insertId: number }).insertId;
    const [rows] = await trackerPool.query(
      `SELECT c.*, u.name AS author_name, u.role AS author_role
       FROM requirement_comments c JOIN users u ON u.id = c.author_id
       WHERE c.id = ?`,
      [insertId],
    );
    res.status(201).json(serializeComment((rows as CommentRow[])[0]));
  } catch (err) {
    next(err);
  }
});

export default router;

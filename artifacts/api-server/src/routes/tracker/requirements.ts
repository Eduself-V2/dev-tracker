import { Router, type IRouter } from "express";
import sanitizeHtml from "sanitize-html";
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
  type AttachmentRow,
} from "../../lib/trackerDb";
import { sendEmail } from "../../lib/ses";
import { deleteFromS3 } from "../../lib/s3";
import { taskAssignedTemplate, testerAssignedTemplate, statusTransitionTemplate, adminAlertTemplate } from "../../lib/emailTemplates";

// Comment bodies and requirement descriptions are authored as rich text (bold/italic/lists/links)
// by the Tiptap editor on the frontend. Strip anything else server-side so a bypassed/hand-crafted
// client can't store scripts or other unsafe markup that would later run when rendered back to other users.
function sanitizeRichText(body: string): string {
  return sanitizeHtml(body, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "s", "strike", "ul", "ol", "li", "a", "h1", "h2", "h3"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
  }).trim();
}

function stripHtmlForPreview(body: string, maxLength: number): string {
  const text = sanitizeHtml(body, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxLength);
}

async function getUserEmails(ids: number[]): Promise<Map<number, { name: string; email: string }>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const placeholders = unique.map(() => "?").join(", ");
  const [rows] = await trackerPool.query(
    `SELECT id, name, email FROM users WHERE id IN (${placeholders})`,
    unique,
  );
  const map = new Map<number, { name: string; email: string }>();
  for (const r of rows as Array<{ id: number; name: string; email: string }>) {
    map.set(r.id, { name: r.name, email: r.email });
  }
  return map;
}

const router: IRouter = Router();

type Status = RequirementRow["status"];

const ALLOWED_TRANSITIONS: Record<TrackerRole, Record<Status, Status[]>> = {
  admin: {
    open: ["in_testing", "confirmed"],
    in_testing: ["confirmed", "needs_fix"],
    needs_fix: ["in_testing", "confirmed"],
    confirmed: ["pushed_to_production", "open"],
    pushed_to_production: ["open"],
  },
  manager: {
    open: ["in_testing"],
    in_testing: ["confirmed", "needs_fix"],
    needs_fix: ["in_testing"],
    confirmed: [],
    pushed_to_production: [],
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
  const testerIds = r.tester_ids ? r.tester_ids.split(",").map(Number) : [];
  const testerNames = r.tester_names ? r.tester_names.split(",") : [];
  const assigneeIds = r.assignee_ids ? r.assignee_ids.split(",").map(Number) : [];
  const assigneeNames = r.assignee_names ? r.assignee_names.split(",") : [];
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    developerId: r.developer_id,
    developerName: r.developer_name,
    testerIds,
    testerNames,
    assigneeIds,
    assigneeNames,
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
    parentId: c.parent_id ?? null,
    isPinned: !!c.is_pinned,
    createdAt: c.created_at.toISOString(),
  };
}

function serializeAttachment(a: AttachmentRow) {
  return {
    id: a.id,
    requirementId: a.requirement_id,
    commentId: a.comment_id,
    s3Url: a.s3_url,
    originalName: a.original_name,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
    uploadedBy: a.uploaded_by,
    uploaderName: a.uploader_name,
    createdAt: a.created_at.toISOString(),
  };
}

const REQ_LIST_SQL = `
  SELECT r.*,
    ANY_VALUE(d.name) AS developer_name,
    GROUP_CONCAT(DISTINCT rt.tester_id ORDER BY rt.tester_id SEPARATOR ',') AS tester_ids,
    GROUP_CONCAT(DISTINCT t.name ORDER BY rt.tester_id SEPARATOR ',') AS tester_names,
    ANY_VALUE(a.name) AS assignee_name,
    GROUP_CONCAT(DISTINCT ra.user_id ORDER BY ra.id SEPARATOR ',') AS assignee_ids,
    GROUP_CONCAT(DISTINCT au.name ORDER BY ra.id SEPARATOR ',') AS assignee_names,
    ANY_VALUE(p.name) AS project_name
  FROM requirements r
  JOIN users d ON d.id = r.developer_id
  LEFT JOIN requirement_testers rt ON rt.requirement_id = r.id
  LEFT JOIN users t ON t.id = rt.tester_id
  LEFT JOIN users a ON a.id = r.assignee_id
  LEFT JOIN requirement_assignees ra ON ra.requirement_id = r.id
  LEFT JOIN users au ON au.id = ra.user_id
  JOIN projects p ON p.id = r.project_id
`;

router.get("/", async (req, res, next) => {
  try {
    const params = TrackerListRequirementsQueryParams.parse(req.query);
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.projectId) {
      const projectIds = params.projectId
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      if (projectIds.length > 0) {
        conditions.push(`r.project_id IN (${projectIds.map(() => "?").join(",")})`);
        values.push(...projectIds);
      }
    }
    if (params.status) {
      const validStatuses = Object.keys(ALLOWED_TRANSITIONS.admin) as Status[];
      const statuses = params.status
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is Status => (validStatuses as string[]).includes(s));
      if (statuses.length > 0) {
        conditions.push(`r.status IN (${statuses.map(() => "?").join(",")})`);
        values.push(...statuses);
      }
    }
    if (params.search && params.search.trim().length > 0) {
      conditions.push("(r.title LIKE ? OR r.description LIKE ?)");
      const term = `%${params.search.trim()}%`;
      values.push(term, term);
    }
    if (params.createdBy !== undefined) {
      conditions.push("r.developer_id = ?");
      values.push(params.createdBy);
    }
    if (params.testedBy !== undefined) {
      if (params.testedBy === null) {
        conditions.push("NOT EXISTS (SELECT 1 FROM requirement_testers rt_f WHERE rt_f.requirement_id = r.id)");
      } else {
        conditions.push("EXISTS (SELECT 1 FROM requirement_testers rt_f WHERE rt_f.requirement_id = r.id AND rt_f.tester_id = ?)");
        values.push(params.testedBy);
      }
    }
    if (params.assignedTo !== undefined) {
      if (params.assignedTo === null) {
        conditions.push("NOT EXISTS (SELECT 1 FROM requirement_assignees ra_f WHERE ra_f.requirement_id = r.id)");
      } else {
        conditions.push("EXISTS (SELECT 1 FROM requirement_assignees ra_f WHERE ra_f.requirement_id = r.id AND ra_f.user_id = ?)");
        values.push(params.assignedTo);
      }
    }
    if (params.mine && req.trackerUser!.role === "admin") {
      const me = req.trackerUser!;
      conditions.push("EXISTS (SELECT 1 FROM requirement_assignees ra_f WHERE ra_f.requirement_id = r.id AND ra_f.user_id = ?)");
      values.push(me.id);
    } else if (params.mine || req.trackerUser!.role !== "admin") {
      const me = req.trackerUser!;
      conditions.push("(r.developer_id = ? OR EXISTS (SELECT 1 FROM requirement_assignees ra_f WHERE ra_f.requirement_id = r.id AND ra_f.user_id = ?) OR EXISTS (SELECT 1 FROM requirement_testers rt_f WHERE rt_f.requirement_id = r.id AND rt_f.tester_id = ?))");
      values.push(me.id, me.id, me.id);
    }
    const where =
      conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await trackerPool.query(
      `${REQ_LIST_SQL}${where} GROUP BY r.id ORDER BY r.updated_at DESC`,
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
    if (me.role !== "developer" && me.role !== "admin" && me.role !== "manager") {
      res.status(403).json({ error: "Only developers can create requirements" });
      return;
    }
    const body = TrackerCreateRequirementBody.parse(req.body);

    if (body.testerIds && body.testerIds.length > 0) {
      const placeholders = body.testerIds.map(() => "?").join(", ");
      const [trows] = await trackerPool.query(
        `SELECT id FROM users WHERE id IN (${placeholders})`,
        body.testerIds,
      );
      if ((trows as Array<{ id: number }>).length !== body.testerIds.length) {
        res.status(400).json({ error: "One or more QA users not found" });
        return;
      }
    }

    const assigneeIds = body.assigneeIds && body.assigneeIds.length > 0 ? body.assigneeIds : [me.id];
    if (assigneeIds.length > 0) {
      const placeholders = assigneeIds.map(() => "?").join(", ");
      const [arows] = await trackerPool.query(
        `SELECT id FROM users WHERE id IN (${placeholders})`,
        assigneeIds,
      );
      if ((arows as Array<{ id: number }>).length !== assigneeIds.length) {
        res.status(400).json({ error: "One or more assignees not found" });
        return;
      }
    }

    const sanitizedDescription = body.description ? sanitizeRichText(body.description) : null;

    const [insertResult] = await trackerPool.query(
      "INSERT INTO requirements (title, description, priority, developer_id, assignee_id, project_id) VALUES (?, ?, ?, ?, ?, ?)",
      [
        body.title,
        sanitizedDescription || null,
        body.priority ?? "medium",
        me.id,
        assigneeIds[0],
        body.projectId,
      ],
    );
    const insertId = (insertResult as { insertId: number }).insertId;

    // Insert all assignees into the join table
    const assigneeValues = assigneeIds.map((uid) => [insertId, uid, me.id]);
    await trackerPool.query(
      "INSERT IGNORE INTO requirement_assignees (requirement_id, user_id, assigned_by_id) VALUES ?",
      [assigneeValues],
    );

    if (body.testerIds && body.testerIds.length > 0) {
      const testerValues = body.testerIds.map((tid) => [insertId, tid]);
      await trackerPool.query(
        "INSERT INTO requirement_testers (requirement_id, tester_id) VALUES ?",
        [testerValues],
      );
    }

    await trackerPool.query(
      "INSERT INTO requirement_events (requirement_id, kind, to_status, actor_id, note) VALUES (?, 'created', 'open', ?, ?)",
      [insertId, me.id, body.testerIds?.length ? `Assigned ${body.testerIds.length} tester(s) at creation` : null],
    );

    const [rows] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ? GROUP BY r.id`,
      [insertId],
    );
    const row = (rows as RequirementListRow[])[0];
    res.status(201).json(serializeRequirementListRow(row));

    // Notify assignees who are not the creator
    const newAssigneeIds = assigneeIds.filter((uid) => uid !== me.id);
    if (newAssigneeIds.length > 0) {
      const userMap = await getUserEmails(newAssigneeIds);
      const emails = newAssigneeIds.map((uid) => userMap.get(uid)?.email).filter((e): e is string => !!e);
      if (emails.length > 0) {
        sendEmail(
          emails,
          `Task assigned to you: ${body.title}`,
          taskAssignedTemplate({
            taskId: insertId,
            taskTitle: body.title,
            assignerName: me.name,
            priority: body.priority ?? "medium",
            projectName: row.project_name,
          }),
        );
      }
    }
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = TrackerGetRequirementParams.parse(req.params);
    const [rrows] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ? GROUP BY r.id`,
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
      `SELECT c.id, c.requirement_id, c.body, c.author_id, c.parent_id, c.is_pinned, c.created_at,
              u.name AS author_name, u.role AS author_role
       FROM requirement_comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.requirement_id = ?
       ORDER BY c.created_at ASC, c.id ASC`,
      [id],
    );
    const [arows] = await trackerPool.query(
      `SELECT a.*, u.name AS uploader_name FROM requirement_attachments a
       JOIN users u ON u.id = a.uploaded_by
       WHERE a.requirement_id = ?
       ORDER BY a.created_at ASC`,
      [id],
    );
    res.json({
      requirement: serializeRequirementListRow(row),
      events: (erows as EventRow[]).map(serializeEvent),
      comments: (crows as CommentRow[]).map(serializeComment),
      attachments: (arows as AttachmentRow[]).map(serializeAttachment),
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
      !(
        (me.role === "developer" || me.role === "manager") &&
        existing.developer_id === me.id
      )
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
      values.push(body.description ? sanitizeRichText(body.description) || null : null);
    }
    if (body.priority !== undefined) {
      fields.push("priority = ?");
      values.push(body.priority);
    }
    let updateTesters = false;
    let oldTesterIds: number[] = [];
    if (body.testerIds !== undefined) {
      if (body.testerIds.length > 0) {
        const placeholders = body.testerIds.map(() => "?").join(", ");
        const [trows] = await trackerPool.query(
          `SELECT id FROM users WHERE id IN (${placeholders})`,
          body.testerIds,
        );
        if ((trows as Array<{ id: number }>).length !== body.testerIds.length) {
          res.status(400).json({ error: "One or more QA users not found" });
          return;
        }
      }
      const [oldTRows] = await trackerPool.query(
        "SELECT tester_id FROM requirement_testers WHERE requirement_id = ?",
        [id],
      );
      oldTesterIds = (oldTRows as Array<{ tester_id: number }>).map((r) => r.tester_id);
      updateTesters = true;
    }
    let updateAssignees = false;
    let oldAssigneeIds: number[] = [];
    if (body.assigneeIds !== undefined) {
      if (body.assigneeIds.length > 0) {
        const placeholders = body.assigneeIds.map(() => "?").join(", ");
        const [arows] = await trackerPool.query(
          `SELECT id FROM users WHERE id IN (${placeholders})`,
          body.assigneeIds,
        );
        if ((arows as Array<{ id: number }>).length !== body.assigneeIds.length) {
          res.status(400).json({ error: "One or more assignees not found" });
          return;
        }
      }
      const [oldARows] = await trackerPool.query(
        "SELECT user_id FROM requirement_assignees WHERE requirement_id = ?",
        [id],
      );
      oldAssigneeIds = (oldARows as Array<{ user_id: number }>).map((r) => r.user_id);
      updateAssignees = true;
      // Keep assignee_id in sync with first assignee
      fields.push("assignee_id = ?");
      values.push(body.assigneeIds[0] ?? null);
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

    if (fields.length > 0 || updateTesters || updateAssignees) {
      if (fields.length > 0) {
        values.push(id);
        await trackerPool.query(
          `UPDATE requirements SET ${fields.join(", ")} WHERE id = ?`,
          values,
        );
      }
      if (updateTesters) {
        await trackerPool.query(
          "DELETE FROM requirement_testers WHERE requirement_id = ?",
          [id],
        );
        if (body.testerIds!.length > 0) {
          const testerValues = body.testerIds!.map((tid) => [id, tid]);
          await trackerPool.query(
            "INSERT INTO requirement_testers (requirement_id, tester_id) VALUES ?",
            [testerValues],
          );
        }
        await trackerPool.query(
          "INSERT INTO requirement_events (requirement_id, kind, actor_id, note) VALUES (?, 'assigned', ?, ?)",
          [id, me.id, body.testerIds!.length === 0 ? "Testers unassigned" : `Testers updated (${body.testerIds!.length})`],
        );
      }
      if (updateAssignees) {
        await trackerPool.query(
          "DELETE FROM requirement_assignees WHERE requirement_id = ?",
          [id],
        );
        if (body.assigneeIds!.length > 0) {
          const assigneeValues = body.assigneeIds!.map((uid) => [id, uid, me.id]);
          await trackerPool.query(
            "INSERT IGNORE INTO requirement_assignees (requirement_id, user_id, assigned_by_id) VALUES ?",
            [assigneeValues],
          );
        }
        await trackerPool.query(
          "INSERT INTO requirement_events (requirement_id, kind, actor_id, note) VALUES (?, 'assigned', ?, ?)",
          [id, me.id, body.assigneeIds!.length === 0 ? "Assignees cleared" : `Assignees updated (${body.assigneeIds!.length})`],
        );
      }
    }

    const [rows] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ? GROUP BY r.id`,
      [id],
    );
    const updated = (rows as RequirementListRow[])[0];
    res.json(serializeRequirementListRow(updated));

    // Notify newly added testers (not in old list, not the actor)
    if (updateTesters && body.testerIds && body.testerIds.length > 0) {
      const newTesterIds = body.testerIds.filter(
        (tid) => !oldTesterIds.includes(tid) && tid !== me.id,
      );
      if (newTesterIds.length > 0) {
        const testerUsers = await getUserEmails(newTesterIds);
        const testerEmails = newTesterIds
          .map((tid) => testerUsers.get(tid)?.email)
          .filter((e): e is string => !!e);
        if (testerEmails.length > 0) {
          sendEmail(
            testerEmails,
            `You've been assigned as a tester: ${updated.title}`,
            testerAssignedTemplate({
              taskId: id,
              taskTitle: updated.title,
              assignerName: me.name,
              priority: updated.priority,
              projectName: updated.project_name,
            }),
          );
        }
      }
    }

    // Notify newly added assignees (not in old list, not the actor)
    if (updateAssignees && body.assigneeIds && body.assigneeIds.length > 0) {
      const newIds = body.assigneeIds.filter(
        (uid) => !oldAssigneeIds.includes(uid) && uid !== me.id,
      );
      if (newIds.length > 0) {
        const userMap = await getUserEmails(newIds);
        const emails = newIds.map((uid) => userMap.get(uid)?.email).filter((e): e is string => !!e);
        if (emails.length > 0) {
          sendEmail(
            emails,
            `Task assigned to you: ${updated.title}`,
            taskAssignedTemplate({
              taskId: id,
              taskTitle: updated.title,
              assignerName: me.name,
              priority: updated.priority,
              projectName: updated.project_name,
            }),
          );
        }
      }
    }
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

    const [testerRows] = await trackerPool.query(
      "SELECT tester_id FROM requirement_testers WHERE requirement_id = ?",
      [id],
    );
    const existingTesterIds = (testerRows as Array<{ tester_id: number }>).map((r) => r.tester_id);

    if (
      me.role === "tester" &&
      existingTesterIds.length > 0 &&
      !existingTesterIds.includes(me.id)
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

    // Calculate notifications BEFORE sending response so the event is visible on re-fetch
    const [curAssigneeRows] = await trackerPool.query(
      "SELECT user_id FROM requirement_assignees WHERE requirement_id = ?",
      [id],
    );
    const currentAssigneeIds = (curAssigneeRows as Array<{ user_id: number }>).map((r) => r.user_id);

    let notifyUserIds: (number | null)[];
    if (body.toStatus === "open" || body.toStatus === "confirmed") {
      notifyUserIds = [existing.developer_id, ...currentAssigneeIds];
    } else if (body.toStatus === "in_testing") {
      notifyUserIds = existingTesterIds;
    } else if (body.toStatus === "pushed_to_production") {
      const [adminRows] = await trackerPool.query(
        "SELECT id FROM users WHERE role = 'admin'",
      );
      notifyUserIds = (adminRows as Array<{ id: number }>).map((r) => r.id);
      notifyUserIds.push(existing.developer_id);
    } else {
      // needs_fix — notify developer + assignees + testers
      notifyUserIds = [existing.developer_id, ...currentAssigneeIds, ...existingTesterIds];
    }

    const notifyIds = [...new Set(
      notifyUserIds.filter((uid): uid is number => uid !== null && uid !== me.id),
    )];

    let emailAddresses: string[] = [];
    let recipientNames: string[] = [];
    if (notifyIds.length > 0) {
      const usersMap = await getUserEmails(notifyIds);
      emailAddresses = notifyIds.map((uid) => usersMap.get(uid)?.email).filter((e): e is string => !!e);
      recipientNames = notifyIds.map((uid) => usersMap.get(uid)?.name).filter((n): n is string => !!n);
    }

    if (emailAddresses.length > 0) {
      await trackerPool.query(
        "INSERT INTO requirement_events (requirement_id, kind, actor_id, note) VALUES (?, 'notified', ?, ?)",
        [id, me.id, `Sent mail to: ${recipientNames.join(", ")}`],
      );
    }

    const [rows] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ? GROUP BY r.id`,
      [id],
    );
    const updated = (rows as RequirementListRow[])[0];
    res.json(serializeRequirementListRow(updated));

    // Fire-and-forget email after response
    if (emailAddresses.length > 0) {
      sendEmail(
        emailAddresses,
        `Task status updated: ${updated.title}`,
        statusTransitionTemplate({
          taskId: id,
          taskTitle: updated.title,
          actorName: me.name,
          fromStatus: existing.status,
          toStatus: body.toStatus,
          projectName: updated.project_name,
          note: body.note,
        }),
      );
    }
  } catch (err) {
    next(err);
  }
});

router.post("/:id/assignees", async (req, res, next) => {
  try {
    const reqId = parseInt(String(req.params.id));
    if (isNaN(reqId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const me = req.trackerUser!;
    const { userIds } = req.body ?? {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ error: "userIds must be a non-empty array" });
      return;
    }

    // Only admins or current assignees can delegate
    const [assigneeCheck] = await trackerPool.query(
      "SELECT user_id FROM requirement_assignees WHERE requirement_id = ? AND user_id = ?",
      [reqId, me.id],
    );
    if (me.role !== "admin" && me.role !== "manager" && (assigneeCheck as Array<{ user_id: number }>).length === 0) {
      res.status(403).json({ error: "Only admins or current assignees can delegate this task" });
      return;
    }

    const [rrows] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ? GROUP BY r.id`,
      [reqId],
    );
    const row = (rrows as RequirementListRow[])[0];
    if (!row) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }

    // Validate all userIds exist
    const placeholders = (userIds as number[]).map(() => "?").join(", ");
    const [urows] = await trackerPool.query(
      `SELECT id FROM users WHERE id IN (${placeholders})`,
      userIds,
    );
    if ((urows as Array<{ id: number }>).length !== (userIds as number[]).length) {
      res.status(400).json({ error: "One or more users not found" });
      return;
    }

    // Get current assignees to detect newly added ones
    const [oldARows] = await trackerPool.query(
      "SELECT user_id FROM requirement_assignees WHERE requirement_id = ?",
      [reqId],
    );
    const oldIds = (oldARows as Array<{ user_id: number }>).map((r) => r.user_id);

    const insertValues = (userIds as number[]).map((uid) => [reqId, uid, me.id]);
    await trackerPool.query(
      "INSERT IGNORE INTO requirement_assignees (requirement_id, user_id, assigned_by_id) VALUES ?",
      [insertValues],
    );

    await trackerPool.query(
      "INSERT INTO requirement_events (requirement_id, kind, actor_id, note) VALUES (?, 'assigned', ?, ?)",
      [reqId, me.id, `Delegated to ${(userIds as number[]).length} user(s)`],
    );

    const [updated] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ? GROUP BY r.id`,
      [reqId],
    );
    res.json(serializeRequirementListRow((updated as RequirementListRow[])[0]));

    // Notify newly added users
    const newIds = (userIds as number[]).filter((uid) => !oldIds.includes(uid) && uid !== me.id);
    if (newIds.length > 0) {
      const userMap = await getUserEmails(newIds);
      const emails = newIds.map((uid) => userMap.get(uid)?.email).filter((e): e is string => !!e);
      if (emails.length > 0) {
        sendEmail(
          emails,
          `Task assigned to you: ${row.title}`,
          taskAssignedTemplate({
            taskId: reqId,
            taskTitle: row.title,
            assignerName: me.name,
            priority: row.priority,
            projectName: row.project_name,
          }),
        );
      }
    }
  } catch (err) {
    next(err);
  }
});

router.post("/:id/notify", async (req, res, next) => {
  try {
    const me = req.trackerUser!;
    if (me.role !== "admin" && me.role !== "manager") {
      res.status(403).json({ error: "Only admins can send alerts" });
      return;
    }
    const reqId = parseInt(String(req.params.id));
    if (isNaN(reqId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { userIds, message } = req.body ?? {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ error: "userIds must be a non-empty array" });
      return;
    }

    const [rrows] = await trackerPool.query(
      `${REQ_LIST_SQL} WHERE r.id = ? GROUP BY r.id`,
      [reqId],
    );
    const row = (rrows as RequirementListRow[])[0];
    if (!row) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }

    const targetIds = (userIds as number[]).filter((uid) => uid !== me.id);
    if (targetIds.length === 0) {
      res.json({ sent: 0 });
      return;
    }

    const userMap = await getUserEmails(targetIds);
    const emails = targetIds.map((uid) => userMap.get(uid)?.email).filter((e): e is string => !!e);

    if (emails.length > 0) {
      await sendEmail(
        emails,
        `Alert: ${row.title}`,
        adminAlertTemplate({
          taskId: reqId,
          taskTitle: row.title,
          adminName: me.name,
          projectName: row.project_name,
          message: typeof message === "string" && message.trim() ? message.trim() : undefined,
        }),
      );
      const recipientNames = targetIds.map((uid) => userMap.get(uid)?.name).filter((n): n is string => !!n);
      await trackerPool.query(
        "INSERT INTO requirement_events (requirement_id, kind, actor_id, note) VALUES (?, 'notified', ?, ?)",
        [reqId, me.id, `Alert sent to: ${recipientNames.join(", ")}`],
      );
    }

    res.json({ sent: emails.length });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/comments", async (req, res, next) => {
  try {
    const { id } = TrackerAddCommentParams.parse(req.params);
    const body = TrackerAddCommentBody.parse(req.body);
    const me = req.trackerUser!;
    const parentId: number | null = body.parentId ?? null;

    const sanitizedBody = sanitizeRichText(body.body);
    if (!sanitizedBody) {
      res.status(400).json({ error: "Comment body is required" });
      return;
    }

    const [existRows] = await trackerPool.query(
      "SELECT id FROM requirements WHERE id = ?",
      [id],
    );
    if ((existRows as Array<{ id: number }>).length === 0) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }

    if (parentId !== null) {
      const [prows] = await trackerPool.query(
        "SELECT id FROM requirement_comments WHERE id = ? AND requirement_id = ? AND parent_id IS NULL",
        [parentId, id],
      );
      if ((prows as Array<{ id: number }>).length === 0) {
        res.status(400).json({ error: "Parent comment not found or is itself a reply" });
        return;
      }
    }

    const [insertResult] = await trackerPool.query(
      "INSERT INTO requirement_comments (requirement_id, body, author_id, parent_id) VALUES (?, ?, ?, ?)",
      [id, sanitizedBody, me.id, parentId],
    );
    const previewNote = stripHtmlForPreview(sanitizedBody, 280);
    if (parentId === null) {
      await trackerPool.query(
        "INSERT INTO requirement_events (requirement_id, kind, actor_id, note) VALUES (?, 'comment', ?, ?)",
        [id, me.id, previewNote],
      );
    } else {
      await trackerPool.query(
        "INSERT INTO requirement_events (requirement_id, kind, actor_id, note) VALUES (?, 'reply', ?, ?)",
        [id, me.id, previewNote],
      );
    }
    const insertId = (insertResult as { insertId: number }).insertId;
    const [rows] = await trackerPool.query(
      `SELECT c.id, c.requirement_id, c.body, c.author_id, c.parent_id, c.is_pinned, c.created_at,
              u.name AS author_name, u.role AS author_role
       FROM requirement_comments c JOIN users u ON u.id = c.author_id
       WHERE c.id = ?`,
      [insertId],
    );
    res.status(201).json(serializeComment((rows as CommentRow[])[0]));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/comments/:commentId", async (req, res, next) => {
  try {
    const reqId = parseInt(String(req.params.id));
    const commentId = parseInt(String(req.params.commentId));
    const me = req.trackerUser!;

    if (isNaN(reqId) || isNaN(commentId)) {
      res.status(400).json({ error: "Invalid IDs" });
      return;
    }

    const { body: newBody } = req.body ?? {};
    if (!newBody || typeof newBody !== "string") {
      res.status(400).json({ error: "Comment body is required" });
      return;
    }
    const sanitizedBody = sanitizeRichText(newBody);
    if (!sanitizedBody) {
      res.status(400).json({ error: "Comment body is required" });
      return;
    }

    const [crows] = await trackerPool.query(
      "SELECT * FROM requirement_comments WHERE id = ? AND requirement_id = ?",
      [commentId, reqId],
    );
    const comment = (crows as CommentRow[])[0];
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    if (me.role !== "admin" && comment.author_id !== me.id) {
      res.status(403).json({ error: "You can only edit your own comments" });
      return;
    }

    await trackerPool.query(
      "UPDATE requirement_comments SET body = ? WHERE id = ?",
      [sanitizedBody, commentId],
    );

    const [rows] = await trackerPool.query(
      `SELECT c.id, c.requirement_id, c.body, c.author_id, c.parent_id, c.is_pinned, c.created_at,
              u.name AS author_name, u.role AS author_role
       FROM requirement_comments c JOIN users u ON u.id = c.author_id
       WHERE c.id = ?`,
      [commentId],
    );
    res.json(serializeComment((rows as CommentRow[])[0]));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/comments/:commentId/pin", async (req, res, next) => {
  try {
    const reqId = parseInt(String(req.params.id));
    const commentId = parseInt(String(req.params.commentId));
    const me = req.trackerUser!;

    if (isNaN(reqId) || isNaN(commentId)) {
      res.status(400).json({ error: "Invalid IDs" });
      return;
    }

    const [crows] = await trackerPool.query(
      "SELECT * FROM requirement_comments WHERE id = ? AND requirement_id = ?",
      [commentId, reqId],
    );
    const comment = (crows as CommentRow[])[0];
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    if (me.role !== "admin" && comment.author_id !== me.id) {
      res.status(403).json({ error: "You can only pin your own comments" });
      return;
    }

    await trackerPool.query("UPDATE requirement_comments SET is_pinned = 1 WHERE id = ?", [commentId]);

    const [rows] = await trackerPool.query(
      `SELECT c.id, c.requirement_id, c.body, c.author_id, c.parent_id, c.is_pinned, c.created_at,
              u.name AS author_name, u.role AS author_role
       FROM requirement_comments c JOIN users u ON u.id = c.author_id
       WHERE c.id = ?`,
      [commentId],
    );
    res.json(serializeComment((rows as CommentRow[])[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/comments/:commentId/pin", async (req, res, next) => {
  try {
    const reqId = parseInt(String(req.params.id));
    const commentId = parseInt(String(req.params.commentId));
    const me = req.trackerUser!;

    if (isNaN(reqId) || isNaN(commentId)) {
      res.status(400).json({ error: "Invalid IDs" });
      return;
    }

    const [crows] = await trackerPool.query(
      "SELECT * FROM requirement_comments WHERE id = ? AND requirement_id = ?",
      [commentId, reqId],
    );
    const comment = (crows as CommentRow[])[0];
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    if (me.role !== "admin" && comment.author_id !== me.id) {
      res.status(403).json({ error: "You can only unpin your own comments" });
      return;
    }

    await trackerPool.query("UPDATE requirement_comments SET is_pinned = 0 WHERE id = ?", [commentId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const reqId = parseInt(String(req.params.id));
    if (isNaN(reqId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    if (req.trackerUser!.role !== "admin") {
      res.status(403).json({ error: "Only admins can delete requirements" });
      return;
    }
    const [result] = await trackerPool.query(
      "DELETE FROM requirements WHERE id = ?",
      [reqId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/comments/:commentId", async (req, res, next) => {
  try {
    const reqId = parseInt(String(req.params.id));
    const commentId = parseInt(String(req.params.commentId));
    const me = req.trackerUser!;

    if (isNaN(reqId) || isNaN(commentId)) {
      res.status(400).json({ error: "Invalid IDs" });
      return;
    }

    const [crows] = await trackerPool.query(
      "SELECT * FROM requirement_comments WHERE id = ? AND requirement_id = ?",
      [commentId, reqId],
    );
    const comment = (crows as CommentRow[])[0];
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    if (me.role !== "admin" && comment.author_id !== me.id) {
      res.status(403).json({ error: "You can only delete your own comments" });
      return;
    }

    // Collect IDs of this comment plus any replies (cascade will delete them from DB)
    const [replyRows] = await trackerPool.query(
      "SELECT id FROM requirement_comments WHERE parent_id = ?",
      [commentId],
    );
    const allCommentIds = [commentId, ...(replyRows as Array<{ id: number }>).map((r) => r.id)];

    // Fetch all S3 keys for attachments on these comments
    const placeholders = allCommentIds.map(() => "?").join(", ");
    const [attRows] = await trackerPool.query(
      `SELECT s3_key FROM requirement_attachments WHERE comment_id IN (${placeholders})`,
      allCommentIds,
    );
    const s3Keys = (attRows as Array<{ s3_key: string }>).map((a) => a.s3_key);

    // Delete comment (DB cascade removes attachment rows and reply rows)
    await trackerPool.query(
      "DELETE FROM requirement_comments WHERE id = ?",
      [commentId],
    );

    // Delete S3 files after DB rows are gone
    await Promise.allSettled(s3Keys.map((key) => deleteFromS3(key)));

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;

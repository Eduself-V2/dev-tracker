import { Router, type IRouter } from "express";
import { trackerPool, type RequirementListRow } from "../../lib/trackerDb";

const router: IRouter = Router();

router.get("/summary", async (req, res, next) => {
  try {
    const me = req.trackerUser!;
    const projectId = req.query.projectId;
    const mineFilter = me.role === "admin" ? "" : "assignee_id = ? AND ";
    const mineValue = me.role === "admin" ? [] : [me.id];
    const projectFilter = projectId ? "project_id = ? AND " : "";
    const projectValues = projectId ? [projectId] : [];
    const whereValues = [...mineValue, ...projectValues];

    const [counts] = await trackerPool.query(
      `SELECT status, COUNT(*) AS c FROM requirements WHERE ${mineFilter}${projectFilter}1=1 GROUP BY status`,
      whereValues,
    );
    const map: Record<string, number> = {};
    for (const row of counts as Array<{ status: string; c: number }>) {
      map[row.status] = Number(row.c);
    }
    const total = Object.values(map).reduce((a, b) => a + b, 0);

    let myOpen = 0;
    const myOpenMine = me.role === "admin" ? "" : "assignee_id = ? AND ";
    const myOpenValues = me.role === "admin" ? projectValues : [me.id, ...projectValues];

    if (me.role === "admin") {
      myOpen = total - (map.pushed_to_production ?? 0);
    } else {
      const [r] = await trackerPool.query(
        `SELECT COUNT(*) AS c FROM requirements WHERE ${myOpenMine}${projectFilter}status NOT IN ('pushed_to_production')`,
        myOpenValues,
      );
      myOpen = Number((r as Array<{ c: number }>)[0]?.c ?? 0);
    }

    const recentProject = projectId ? " AND r.project_id = ?" : "";
    const recentMine = me.role === "admin" ? "" : " AND r.assignee_id = ?";
    const recentValues = [
      ...(projectId ? [projectId] : []),
      ...(me.role === "admin" ? [] : [me.id]),
    ];

    const [recentRows] = await trackerPool.query(
      `SELECT r.*, d.name AS developer_name, t.name AS tester_name, a.name AS assignee_name, p.name AS project_name,
              GREATEST(r.updated_at, COALESCE(MAX(e.created_at), r.updated_at)) AS last_activity_at
       FROM requirements r
       JOIN users d ON d.id = r.developer_id
       LEFT JOIN users t ON t.id = r.tester_id
       LEFT JOIN users a ON a.id = r.assignee_id
       JOIN projects p ON p.id = r.project_id
       LEFT JOIN requirement_events e ON e.requirement_id = r.id
       WHERE 1=1${recentProject}${recentMine}
       GROUP BY r.id
       ORDER BY last_activity_at DESC
       LIMIT 8`,
      recentValues,
    );

    res.json({
      total,
      open: map.open ?? 0,
      inTesting: map.in_testing ?? 0,
      needsFix: map.needs_fix ?? 0,
      confirmed: map.confirmed ?? 0,
      pushedToProduction: map.pushed_to_production ?? 0,
      myOpen,
      recent: (recentRows as RequirementListRow[]).map((r) => ({
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
        testCycles: r.test_cycles,
        projectName: r.project_name,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
        lastActivityAt: (r.last_activity_at ?? r.updated_at).toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/report", async (req, res, next) => {
  try {
    const me = req.trackerUser!;
    const { userId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    // Non-admins can only query their own data
    if (me.role !== "admin" && userId && Number(userId) !== me.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const targetUserId: number | null =
      me.role === "admin" ? (userId ? Number(userId) : null) : me.id;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);

    const userWhere = targetUserId ? "WHERE u.id = ?" : "";
    const userParam = targetUserId ? [targetUserId] : [];

    const [users] = await trackerPool.query(
      `SELECT id, name FROM users ${userWhere} ORDER BY name`,
      userParam,
    );

    const uid = targetUserId;
    const [createdRows] = await trackerPool.query(
      `SELECT r.developer_id AS user_id, COUNT(*) AS cnt
       FROM requirements r
       WHERE r.created_at BETWEEN ? AND ?
         ${uid ? "AND r.developer_id = ?" : ""}
       GROUP BY r.developer_id`,
      uid ? [start, end, uid] : [start, end],
    );

    const [assignedRows] = await trackerPool.query(
      `SELECT user_id, COUNT(DISTINCT req_id) AS cnt FROM (
         SELECT r.developer_id AS user_id, r.id AS req_id FROM requirements r
           WHERE r.created_at BETWEEN ? AND ? ${uid ? "AND r.developer_id = ?" : ""}
         UNION ALL
         SELECT r.tester_id, r.id FROM requirements r
           WHERE r.tester_id IS NOT NULL AND r.created_at BETWEEN ? AND ? ${uid ? "AND r.tester_id = ?" : ""}
         UNION ALL
         SELECT r.assignee_id, r.id FROM requirements r
           WHERE r.assignee_id IS NOT NULL AND r.created_at BETWEEN ? AND ? ${uid ? "AND r.assignee_id = ?" : ""}
       ) t GROUP BY user_id`,
      uid
        ? [start, end, uid, start, end, uid, start, end, uid]
        : [start, end, start, end, start, end],
    );

    const [transitionRows] = await trackerPool.query(
      `SELECT e.actor_id AS user_id, e.to_status, COUNT(*) AS cnt
       FROM requirement_events e
       WHERE e.kind = 'transitioned' AND e.created_at BETWEEN ? AND ?
         ${uid ? "AND e.actor_id = ?" : ""}
       GROUP BY e.actor_id, e.to_status`,
      uid ? [start, end, uid] : [start, end],
    );

    const [commentRows] = await trackerPool.query(
      `SELECT c.author_id AS user_id, COUNT(*) AS cnt
       FROM requirement_comments c
       WHERE c.created_at BETWEEN ? AND ?
         ${uid ? "AND c.author_id = ?" : ""}
       GROUP BY c.author_id`,
      uid ? [start, end, uid] : [start, end],
    );

    const createdMap: Record<number, number> = {};
    for (const r of createdRows as Array<{ user_id: number; cnt: number }>)
      createdMap[r.user_id] = Number(r.cnt);

    const assignedMap: Record<number, number> = {};
    for (const r of assignedRows as Array<{ user_id: number; cnt: number }>)
      assignedMap[r.user_id] = Number(r.cnt);

    const transMap: Record<number, Record<string, number>> = {};
    for (const r of transitionRows as Array<{ user_id: number; to_status: string; cnt: number }>) {
      if (!transMap[r.user_id]) transMap[r.user_id] = {};
      transMap[r.user_id][r.to_status] = Number(r.cnt);
    }

    const commentMap: Record<number, number> = {};
    for (const r of commentRows as Array<{ user_id: number; cnt: number }>)
      commentMap[r.user_id] = Number(r.cnt);

    const result = (users as Array<{ id: number; name: string }>).map((u) => ({
      userId: u.id,
      userName: u.name,
      tasksCreated: createdMap[u.id] ?? 0,
      tasksAssigned: assignedMap[u.id] ?? 0,
      statusTransitions: {
        open: transMap[u.id]?.open ?? 0,
        in_testing: transMap[u.id]?.in_testing ?? 0,
        needs_fix: transMap[u.id]?.needs_fix ?? 0,
        confirmed: transMap[u.id]?.confirmed ?? 0,
        pushed_to_production: transMap[u.id]?.pushed_to_production ?? 0,
      },
      comments: commentMap[u.id] ?? 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

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
      `SELECT r.*, d.name AS developer_name, t.name AS tester_name, a.name AS assignee_name
       FROM requirements r
       JOIN users d ON d.id = r.developer_id
       LEFT JOIN users t ON t.id = r.tester_id
       LEFT JOIN users a ON a.id = r.assignee_id
       WHERE 1=1${recentProject}${recentMine}
       ORDER BY r.updated_at DESC
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
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

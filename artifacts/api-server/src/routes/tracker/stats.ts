import { Router, type IRouter } from "express";
import { trackerPool, type RequirementListRow } from "../../lib/trackerDb";

const router: IRouter = Router();

router.get("/summary", async (req, res, next) => {
  try {
    const me = req.trackerUser!;
    const [counts] = await trackerPool.query(
      `SELECT status, COUNT(*) AS c FROM requirements GROUP BY status`,
    );
    const map: Record<string, number> = {};
    for (const row of counts as Array<{ status: string; c: number }>) {
      map[row.status] = Number(row.c);
    }
    const total = Object.values(map).reduce((a, b) => a + b, 0);

    let myOpen = 0;
    if (me.role === "developer") {
      const [r] = await trackerPool.query(
        `SELECT COUNT(*) AS c FROM requirements WHERE developer_id = ? AND status NOT IN ('pushed_to_production')`,
        [me.id],
      );
      myOpen = Number((r as Array<{ c: number }>)[0]?.c ?? 0);
    } else if (me.role === "tester") {
      const [r] = await trackerPool.query(
        `SELECT COUNT(*) AS c FROM requirements WHERE tester_id = ? AND status = 'in_testing'`,
        [me.id],
      );
      myOpen = Number((r as Array<{ c: number }>)[0]?.c ?? 0);
    } else {
      myOpen = total - (map.pushed_to_production ?? 0);
    }

    const [recentRows] = await trackerPool.query(
      `SELECT r.*, d.name AS developer_name, t.name AS tester_name
       FROM requirements r
       JOIN users d ON d.id = r.developer_id
       LEFT JOIN users t ON t.id = r.tester_id
       ORDER BY r.updated_at DESC
       LIMIT 8`,
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

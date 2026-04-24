import { Router, type IRouter } from "express";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/summary", async (req, res, next) => {
  try {
    const userId = req.userId!;
    const now = new Date();

    const [counts] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        completed: sql<number>`SUM(CASE WHEN ${tasksTable.completed} THEN 1 ELSE 0 END)::int`,
        active: sql<number>`SUM(CASE WHEN NOT ${tasksTable.completed} THEN 1 ELSE 0 END)::int`,
        low: sql<number>`SUM(CASE WHEN ${tasksTable.priority} = 'low' THEN 1 ELSE 0 END)::int`,
        medium: sql<number>`SUM(CASE WHEN ${tasksTable.priority} = 'medium' THEN 1 ELSE 0 END)::int`,
        high: sql<number>`SUM(CASE WHEN ${tasksTable.priority} = 'high' THEN 1 ELSE 0 END)::int`,
      })
      .from(tasksTable)
      .where(eq(tasksTable.userId, userId));

    const [overdueRow] = await db
      .select({
        overdue: sql<number>`COUNT(*)::int`,
      })
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.userId, userId),
          eq(tasksTable.completed, false),
          lt(tasksTable.dueDate, now),
        ),
      );

    const total = counts?.total ?? 0;
    const completed = counts?.completed ?? 0;
    const active = counts?.active ?? 0;
    const overdue = overdueRow?.overdue ?? 0;
    const completionRate = total > 0 ? completed / total : 0;

    res.json({
      total,
      active,
      completed,
      overdue,
      byPriority: {
        low: counts?.low ?? 0,
        medium: counts?.medium ?? 0,
        high: counts?.high ?? 0,
      },
      completionRate,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/recent", async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.userId, req.userId!))
      .orderBy(desc(tasksTable.updatedAt))
      .limit(8);

    res.json(
      rows.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        priority: task.priority,
        completed: task.completed,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;

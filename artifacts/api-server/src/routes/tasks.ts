import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  CreateTaskBody,
  ListTasksQueryParams,
  UpdateTaskBody,
  UpdateTaskParams,
  GetTaskParams,
  DeleteTaskParams,
  ToggleTaskParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

function serialize(task: typeof tasksTable.$inferSelect) {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    priority: task.priority,
    completed: task.completed,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { status, priority, search } = ListTasksQueryParams.parse(req.query);
    const conditions = [eq(tasksTable.userId, req.userId!)];

    if (status === "active") {
      conditions.push(eq(tasksTable.completed, false));
    } else if (status === "completed") {
      conditions.push(eq(tasksTable.completed, true));
    }

    if (priority && priority !== "all") {
      conditions.push(eq(tasksTable.priority, priority));
    }

    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      const searchCondition = or(
        ilike(tasksTable.title, term),
        ilike(tasksTable.description, term),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const rows = await db
      .select()
      .from(tasksTable)
      .where(and(...conditions))
      .orderBy(asc(tasksTable.completed), desc(tasksTable.createdAt));

    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = CreateTaskBody.parse(req.body);
    const [row] = await db
      .insert(tasksTable)
      .values({
        userId: req.userId!,
        title: body.title,
        description: body.description ?? null,
        priority: body.priority ?? "medium",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      })
      .returning();
    res.status(201).json(serialize(row));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = GetTaskParams.parse(req.params);
    const [row] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.userId!)));
    if (!row) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(serialize(row));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = UpdateTaskParams.parse(req.params);
    const body = UpdateTaskBody.parse(req.body);

    const update: Partial<typeof tasksTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.title !== undefined) update.title = body.title;
    if (body.description !== undefined)
      update.description = body.description ?? null;
    if (body.priority !== undefined) update.priority = body.priority;
    if (body.completed !== undefined) update.completed = body.completed;
    if (body.dueDate !== undefined)
      update.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    const [row] = await db
      .update(tasksTable)
      .set(update)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.userId!)))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(serialize(row));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = DeleteTaskParams.parse(req.params);
    const result = await db
      .delete(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.userId!)))
      .returning({ id: tasksTable.id });
    if (result.length === 0) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/toggle", async (req, res, next) => {
  try {
    const { id } = ToggleTaskParams.parse(req.params);
    const [row] = await db
      .update(tasksTable)
      .set({
        completed: sql`NOT ${tasksTable.completed}`,
        updatedAt: new Date(),
      })
      .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.userId!)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(serialize(row));
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import {
  TrackerCreateUserBody,
  TrackerUpdateUserBody,
  TrackerUpdateUserParams,
  TrackerDeleteUserParams,
} from "@workspace/api-zod";
import { trackerPool, type UserRow } from "../../lib/trackerDb";
import { requireTrackerRole } from "../../middlewares/requireTrackerAuth";

const router: IRouter = Router();

router.use(requireTrackerRole("admin"));

function serialize(u: Omit<UserRow, "password_hash">) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    username: u.username,
    role: u.role,
    createdAt: u.created_at.toISOString(),
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await trackerPool.query(
      "SELECT id, name, email, mobile, username, role, created_at FROM users ORDER BY created_at DESC",
    );
    res.json((rows as Array<Omit<UserRow, "password_hash">>).map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = TrackerCreateUserBody.parse(req.body);
    const hash = await bcrypt.hash(body.password, 10);
    try {
      const [result] = await trackerPool.query(
        "INSERT INTO users (name, email, mobile, username, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)",
        [
          body.name,
          body.email,
          body.mobile ?? null,
          body.username,
          hash,
          body.role,
        ],
      );
      const insertId = (result as { insertId: number }).insertId;
      const [rows] = await trackerPool.query(
        "SELECT id, name, email, mobile, username, role, created_at FROM users WHERE id = ?",
        [insertId],
      );
      const user = (rows as Array<Omit<UserRow, "password_hash">>)[0];
      res.status(201).json(serialize(user));
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "ER_DUP_ENTRY") {
        res
          .status(409)
          .json({ error: "Username or email already exists" });
        return;
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = TrackerUpdateUserParams.parse(req.params);
    const body = TrackerUpdateUserBody.parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.name !== undefined) {
      fields.push("name = ?");
      values.push(body.name);
    }
    if (body.email !== undefined) {
      fields.push("email = ?");
      values.push(body.email);
    }
    if (body.mobile !== undefined) {
      fields.push("mobile = ?");
      values.push(body.mobile ?? null);
    }
    if (body.role !== undefined) {
      fields.push("role = ?");
      values.push(body.role);
    }
    if (body.password) {
      const hash = await bcrypt.hash(body.password, 10);
      fields.push("password_hash = ?");
      values.push(hash);
    }
    if (fields.length > 0) {
      values.push(id);
      try {
        await trackerPool.query(
          `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
          values,
        );
      } catch (e) {
        const err = e as { code?: string };
        if (err.code === "ER_DUP_ENTRY") {
          res.status(409).json({ error: "Email already exists" });
          return;
        }
        throw e;
      }
    }
    const [rows] = await trackerPool.query(
      "SELECT id, name, email, mobile, username, role, created_at FROM users WHERE id = ?",
      [id],
    );
    const user = (rows as Array<Omit<UserRow, "password_hash">>)[0];
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(serialize(user));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = TrackerDeleteUserParams.parse(req.params);
    if (req.trackerUser!.id === id) {
      res.status(400).json({ error: "Cannot delete your own account" });
      return;
    }
    try {
      const [result] = await trackerPool.query(
        "DELETE FROM users WHERE id = ?",
        [id],
      );
      if ((result as { affectedRows: number }).affectedRows === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.status(204).end();
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "ER_ROW_IS_REFERENCED_2") {
        res.status(409).json({
          error: "Cannot delete user — they are referenced by requirements",
        });
        return;
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
});

export default router;

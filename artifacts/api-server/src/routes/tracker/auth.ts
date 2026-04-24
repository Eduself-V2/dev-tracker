import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { TrackerLoginBody } from "@workspace/api-zod";
import { trackerPool, type UserRow } from "../../lib/trackerDb";
import { requireTrackerAuth } from "../../middlewares/requireTrackerAuth";

const router: IRouter = Router();

router.post("/login", async (req, res, next) => {
  try {
    const body = TrackerLoginBody.parse(req.body);
    const [rows] = await trackerPool.query(
      "SELECT id, name, email, mobile, username, password_hash, role, created_at FROM users WHERE username = ?",
      [body.username],
    );
    const user = (rows as UserRow[])[0];
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const ok = await bcrypt.compare(body.password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    req.session.trackerUserId = user.id;
    req.session.save((err) => {
      if (err) {
        next(err);
        return;
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        username: user.username,
        role: user.role,
        createdAt: user.created_at.toISOString(),
      });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      next(err);
      return;
    }
    res.clearCookie("tracker.sid");
    res.status(204).end();
  });
});

router.get("/me", requireTrackerAuth, (req, res) => {
  const u = req.trackerUser!;
  res.json({
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  });
});

export default router;

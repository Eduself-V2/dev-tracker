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
      "SELECT id, name, email, mobile, username, password_hash, role, created_at, password_reset_required FROM users WHERE username = ?",
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
        passwordResetRequired: Boolean(user.password_reset_required),
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
    passwordResetRequired: u.passwordResetRequired,
  });
});

router.post("/reset-password", requireTrackerAuth, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== "string" || password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    await trackerPool.query(
      "UPDATE users SET password_hash = ?, password_reset_required = 0 WHERE id = ?",
      [hash, req.trackerUser!.id],
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;

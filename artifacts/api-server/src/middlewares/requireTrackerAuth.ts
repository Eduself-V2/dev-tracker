import type { Request, Response, NextFunction } from "express";
import { trackerPool, type TrackerRole, type UserRow } from "../lib/trackerDb";

declare module "express-session" {
  interface SessionData {
    trackerUserId?: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      trackerUser?: {
        id: number;
        name: string;
        email: string;
        mobile: string | null;
        username: string;
        role: TrackerRole;
        createdAt: Date;
        passwordResetRequired: boolean;
      };
    }
  }
}

export async function loadTrackerUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.session?.trackerUserId;
    if (!userId) {
      next();
      return;
    }
    const [rows] = await trackerPool.query(
      "SELECT id, name, email, mobile, username, role, created_at, password_reset_required FROM users WHERE id = ?",
      [userId],
    );
    const user = (rows as Array<Omit<UserRow, "password_hash">>)[0];
    if (user) {
      req.trackerUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        username: user.username,
        role: user.role,
        createdAt: user.created_at,
        passwordResetRequired: Boolean(user.password_reset_required),
      };
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireTrackerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.trackerUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireTrackerRole(...roles: TrackerRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.trackerUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.trackerUser.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

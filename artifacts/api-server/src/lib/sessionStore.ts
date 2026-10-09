import session from "express-session";
import type { RowDataPacket } from "mysql2/promise";
import { trackerPool } from "./trackerDb";
import { logger } from "./logger";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;
const CLEANUP_INTERVAL_MS = 1000 * 60 * 15;

function expiresAt(sess: session.SessionData): number {
  const expires = sess.cookie?.expires;
  const ms = expires ? new Date(expires).getTime() : Date.now() + DEFAULT_TTL_MS;
  return Math.floor(ms / 1000);
}

/**
 * express-session store backed by the `sessions` table, so logins survive
 * API restarts and are shared across multiple server instances.
 */
export class MySqlSessionStore extends session.Store {
  constructor() {
    super();
    const timer = setInterval(() => {
      trackerPool
        .query("DELETE FROM sessions WHERE expires < UNIX_TIMESTAMP()")
        .catch((err) => logger.error({ err }, "Failed to clear expired sessions"));
    }, CLEANUP_INTERVAL_MS);
    timer.unref();
  }

  get(sid: string, cb: (err: unknown, session?: session.SessionData | null) => void) {
    trackerPool
      .query<RowDataPacket[]>(
        "SELECT data FROM sessions WHERE sid = ? AND expires >= UNIX_TIMESTAMP()",
        [sid],
      )
      .then(([rows]) => cb(null, rows.length ? JSON.parse(rows[0].data) : null))
      .catch((err) => cb(err));
  }

  set(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void) {
    trackerPool
      .query(
        "INSERT INTO sessions (sid, expires, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)",
        [sid, expiresAt(sess), JSON.stringify(sess)],
      )
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }

  destroy(sid: string, cb?: (err?: unknown) => void) {
    trackerPool
      .query("DELETE FROM sessions WHERE sid = ?", [sid])
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }

  touch(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void) {
    trackerPool
      .query("UPDATE sessions SET expires = ? WHERE sid = ?", [expiresAt(sess), sid])
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }
}

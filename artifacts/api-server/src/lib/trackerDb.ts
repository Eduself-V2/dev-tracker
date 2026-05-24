import mysql from "mysql2/promise";

const socketPath =
  process.env.TRACKER_MYSQL_SOCKET ??
  "/home/runner/workspace/.local/mysql/run/mysql.sock";

export const trackerPool = mysql.createPool({
  user: process.env.TRACKER_MYSQL_USER ?? "root",
  password: process.env.TRACKER_MYSQL_PASSWORD ?? "",
  database: process.env.TRACKER_MYSQL_DATABASE ?? "dev_tracker",
  socketPath,
  connectionLimit: 10,
  dateStrings: false,
  decimalNumbers: true,
});

export type TrackerRole = "admin" | "developer" | "tester";

export interface UserRow {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  username: string;
  password_hash: string;
  role: TrackerRole;
  created_at: Date;
  password_reset_required: number;
}

export interface RequirementRow {
  id: number;
  title: string;
  description: string | null;
  status:
    | "open"
    | "in_testing"
    | "needs_fix"
    | "confirmed"
    | "pushed_to_production";
  priority: "low" | "medium" | "high";
  developer_id: number;
  tester_id: number | null;
  test_cycles: number;
  created_at: Date;
  updated_at: Date;
}

export interface RequirementListRow extends RequirementRow {
  developer_name: string;
  tester_name: string | null;
}

export interface EventRow {
  id: number;
  requirement_id: number;
  kind: "created" | "transitioned" | "comment" | "assigned";
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  actor_id: number;
  actor_name: string;
  created_at: Date;
}

export interface CommentRow {
  id: number;
  requirement_id: number;
  body: string;
  author_id: number;
  author_name: string;
  author_role: TrackerRole;
  created_at: Date;
}

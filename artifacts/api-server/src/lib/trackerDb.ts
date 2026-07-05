import mysql from "mysql2/promise";

export const trackerPool = mysql.createPool({
  host: process.env.TRACKER_MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.TRACKER_MYSQL_PORT ?? 3306),
  user: process.env.TRACKER_MYSQL_USER ?? "root",
  password: process.env.TRACKER_MYSQL_PASSWORD ?? "",
  database: process.env.TRACKER_MYSQL_DATABASE ?? "dev_tracker",
  connectionLimit: 10,
  dateStrings: false,
  decimalNumbers: true,
});

export type TrackerRole = "admin" | "manager" | "developer" | "tester";

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

export interface ProjectRow {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
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
  assignee_id: number | null;
  test_cycles: number;
  project_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface RequirementListRow extends RequirementRow {
  developer_name: string;
  tester_ids: string | null;
  tester_names: string | null;
  assignee_name: string | null;
  assignee_ids: string | null;
  assignee_names: string | null;
  project_name: string;
  last_activity_at?: Date;
  last_actor_name?: string | null;
}

export interface EventRow {
  id: number;
  requirement_id: number;
  kind: "created" | "transitioned" | "comment" | "assigned" | "notified";
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
  parent_id: number | null;
  is_pinned: number;
  created_at: Date;
}

export type ReferenceVisibilityMode = "admin_only" | "all" | "custom";

export interface ProjectReferenceRow {
  id: number;
  project_id: number;
  label: string;
  value: string;
  is_sensitive: number;
  visibility_mode: ReferenceVisibilityMode;
  created_by: number;
  creator_name: string;
  created_at: Date;
  updated_at: Date;
  vis_user_ids: string | null;
  vis_roles: string | null;
}

export interface AttachmentRow {
  id: number;
  requirement_id: number;
  comment_id: number | null;
  s3_key: string;
  s3_url: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: number;
  uploader_name: string;
  created_at: Date;
}

# Workspace

## Overview

Single-app pnpm monorepo:

**Dev Tracker** (`dev-tracker`) — developer/QA workflow tracker for small in-house teams. React + Vite + local username/password auth + MySQL.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite + Tailwind v4 + wouter + @tanstack/react-query
- **Auth**: express-session + bcryptjs (local username/password)
- **API framework**: Express 5
- **Database**: MySQL 8 + raw mysql2
- **Validation**: Zod (`zod/v4`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

- `dev-tracker` (`/tracker`) — Dev Tracker web app: login, dashboard, requirements list/create/detail, users admin, projects.
- `api-server` (`/api`) — Express API for Dev Tracker (session-cookie protected, MySQL).
- `mockup-sandbox` — design sandbox.

## Dev Tracker

### Auth & roles

- Local username/password (NOT Clerk). Cookie-based session via `express-session` (cookie name `tracker.sid`, `httpOnly`, 14-day TTL).
- Roles: `admin`, `developer`, `tester`. Admin manages the user roster.
- Default admin seeded on first init: **username `admin` / password `admin123`** (change in production).

### Workflow stages

`open → in_testing → needs_fix → confirmed → pushed_to_production`

Allowed transitions (enforced by both UI and API):

- **developer**: open→in_testing, needs_fix→in_testing, confirmed→pushed_to_production
- **tester**: in_testing→confirmed, in_testing→needs_fix (only the assigned tester)
- **admin**: any transition

Every move into `in_testing` increments the requirement's `test_cycles` counter (so a requirement that fails testing twice and finally passes shows 3 cycles).

### Data model (MySQL `dev_tracker`)

- `users` — `id`, `name`, `email` (unique), `mobile`, `username` (unique), `password_hash`, `role`, `created_at`, `password_reset_required`.
- `requirements` — `id`, `title`, `description`, `status`, `priority`, `developer_id`, `tester_id`, `assignee_id`, `project_id`, `test_cycles`, `created_at`, `updated_at`.
- `requirement_events` — append-only timeline (`created`, `transitioned`, `comment`, `assigned`).
- `requirement_comments` — comment thread per requirement.
- `projects` — `id`, `name`, `description`, `created_at`.

### MySQL

- Binary: MySQL 8.0.42.
- Workflow `MySQL` runs `bash .local/mysql/start.sh`.
- Listens on socket `/home/runner/workspace/.local/mysql/run/mysql.sock` (root@localhost, empty password). The api-server connects via socket only.
- Database: `dev_tracker`.

### Seeding the default admin

```
pnpm --filter @workspace/api-server exec tsx scripts/seed-tracker-admin.ts
```

Override with env: `TRACKER_ADMIN_USERNAME`, `TRACKER_ADMIN_PASSWORD`, `TRACKER_ADMIN_EMAIL`, `TRACKER_ADMIN_NAME`.

### Deployment notes

MySQL is currently local-only. To deploy, point `TRACKER_MYSQL_*` env vars at a hosted MySQL service and the same SQL schema will work unchanged.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/dev-tracker run dev` — run Dev Tracker locally
- `pnpm --filter @workspace/api-server exec tsx scripts/seed-tracker-admin.ts` — seed Dev Tracker default admin

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

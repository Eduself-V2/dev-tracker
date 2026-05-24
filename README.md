# Dev Tracker

A developer/QA workflow tracker for small in-house teams.

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS v4 + wouter + TanStack Query
- **API**: Express 5 + TypeScript + Zod validation
- **Database**: MySQL 8 (raw mysql2 queries)
- **Auth**: Local username/password with bcryptjs + express-session
- **Build**: esbuild

## Prerequisites

- Node.js 24
- pnpm (recommended) or npm
- MySQL 8 running locally (or a hosted MySQL service)

## Quick Start

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd <repo-folder>
pnpm install
```

### 2. Create the database

Connect to MySQL as root (or a user with CREATE DATABASE privileges) and run the schema:

```bash
mysql -u root -p < schema.sql
```

This creates the `dev_tracker` database with all required tables.

### 3. Configure environment variables

Create a `.env` file in the project root (or set env vars in your shell). The only required variables are:

```bash
# Required — the port for the API server
PORT=8080

# Required — a secret string for session cookies
SESSION_SECRET=change-me-in-production-to-a-random-string

# Optional — MySQL connection (defaults to local socket)
# If you use TCP instead of a Unix socket, set these:
# TRACKER_MYSQL_HOST=127.0.0.1
# TRACKER_MYSQL_PORT=3306
# TRACKER_MYSQL_USER=root
# TRACKER_MYSQL_PASSWORD=yourpassword
# TRACKER_MYSQL_DATABASE=dev_tracker
```

If you run MySQL via the included `.local/mysql/start.sh` script, the defaults will work without any env vars.

### 4. Seed the default admin

```bash
pnpm --filter @workspace/api-server exec tsx scripts/seed-tracker-admin.ts
```

This creates the first admin user. The default credentials are:

- Username: `admin`
- Password: `admin123`

You can override them with env vars:

```bash
TRACKER_ADMIN_USERNAME=admin \
TRACKER_ADMIN_PASSWORD=admin123 \
TRACKER_ADMIN_EMAIL=admin@dev-tracker.local \
TRACKER_ADMIN_NAME="Default Admin" \
  pnpm --filter @workspace/api-server exec tsx scripts/seed-tracker-admin.ts
```

### 5. Start the services

Start MySQL (if you are running it locally):

```bash
bash .local/mysql/start.sh
```

Start the API server:

```bash
pnpm --filter @workspace/api-server run dev
```

Start the web app in a new terminal:

```bash
pnpm --filter @workspace/dev-tracker run dev
```

### 6. Open the app

The frontend will be served on the port Vite prints (usually `5173`). Open that URL in your browser and log in with the seeded admin credentials.

---

## Project Structure

```
artifacts/
  api-server/       # Express API (port from PORT env var)
  dev-tracker/      # React Vite frontend
  mockup-sandbox/   # Component preview sandbox
lib/
  api-client-react/ # Generated React Query hooks
  api-spec/         # OpenAPI spec + Orval codegen
  api-zod/          # Generated Zod schemas
schema.sql          # Full MySQL schema
```

## Useful Commands

| Command | Description |
|---|---|
| `pnpm run typecheck` | Type-check all packages |
| `pnpm run build` | Build everything |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks/schemas from OpenAPI |
| `pnpm --filter @workspace/api-server run dev` | Start API server |
| `pnpm --filter @workspace/dev-tracker run dev` | Start web frontend |

## Database Tables

- `users` — team members with roles (admin, developer, tester)
- `projects` — project groups for requirements
- `requirements` — work items with status workflow
- `requirement_events` — audit timeline (created, transitioned, comment, assigned)
- `requirement_comments` — threaded comments per requirement

## Requirement Workflow

```
open -> in_testing -> confirmed -> pushed_to_production
              | -> needs_fix ----^
```

- **Developer**: open -> in_testing, needs_fix -> in_testing, confirmed -> pushed_to_production
- **Tester**: in_testing -> confirmed, in_testing -> needs_fix (only if assigned)
- **Admin**: any transition

Every move into `in_testing` increments the `test_cycles` counter.

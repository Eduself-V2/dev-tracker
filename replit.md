# Workspace

## Overview

A simple task manager web app ("Tasker") with user authentication and CRUD on personal tasks. Built as a React + Vite frontend backed by a shared Express API and Postgres, with Clerk handling sign-in/sign-up.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite + Tailwind v4 + wouter + @tanstack/react-query
- **Auth**: Clerk (`@clerk/react`, `@clerk/express`) via Replit-managed Clerk
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

- `task-manager` (`/`) — React + Vite web app: landing page, sign-in/sign-up, task list with filters, dashboard with stats.
- `api-server` (`/api`) — Express API: tasks CRUD + dashboard summary.
- `mockup-sandbox` — design sandbox (unused for this build).

## Data model

- `tasks` — `id`, `userId` (Clerk user id), `title`, `description`, `priority` (low/medium/high), `completed`, `dueDate`, `createdAt`, `updatedAt`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/task-manager run dev` — run web app locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

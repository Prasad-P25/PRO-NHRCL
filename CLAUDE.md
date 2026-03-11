# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PROTECTHER Audit Panel - A full-stack web application for managing construction safety audits. PROTECTHER is a safety auditing organization that conducts audits for multiple client projects. This platform tracks audit compliance, KPIs (LTIFR, TRIFR), CAPA management, and safety maturity assessments across project packages.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript, PostgreSQL, JWT auth, Winston logging
- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, Zustand (state), React Query, Radix UI

## Commands

### Development
```bash
npm run dev              # Start both frontend (port 3000) and backend (port 5000)
npm run dev:frontend     # Frontend only
npm run dev:backend      # Backend only
```

### Database
```bash
npm run db:migrate       # Run migrations (backend workspace)
npm run db:seed          # Seed sample data
npm run cleanup --workspace=backend   # Clean up duplicate records
npm run backup --workspace=backend    # Backup database
```

Migrations are in `backend/src/database/migrations/`. Schema is defined in `migrate.ts`.

### Build & Lint
```bash
npm run build            # Build both workspaces
npm run lint --workspace=frontend    # Lint frontend
npm run lint --workspace=backend     # Lint backend
```

### Testing
```bash
# Frontend (Vitest)
npm run test --workspace=frontend           # Run all tests
npm run test:ui --workspace=frontend        # Interactive UI
npm run test:coverage --workspace=frontend  # Coverage report
npx vitest run src/path/to/file.test.ts --workspace=frontend  # Single file

# Backend (Jest)
npm run test --workspace=backend            # Run all tests
npm run test:watch --workspace=backend      # Watch mode
npm run test:coverage --workspace=backend   # Coverage report
npx jest src/__tests__/file.test.ts         # Single file (run from backend/)
```

Frontend tests in `frontend/src/**/*.{test,spec}.{ts,tsx}`, backend tests in `backend/src/__tests__/`.

## Architecture

### Monorepo Structure
- Root `package.json` uses npm workspaces (`frontend/`, `backend/`)
- `concurrently` runs both servers in dev mode

### Backend (`backend/src/`)
- `controllers/` - Business logic for each domain (audit, capa, kpi, etc.)
- `routes/` - Express route definitions, all mounted under `/api/v1/`
- `middleware/auth.ts` - JWT verification, role-based access
- `middleware/rateLimiter.ts` - API rate limiting
- `database/connection.ts` - PostgreSQL pool with `pg`
- `database/migrate.ts` - Schema migrations
- `database/seed.ts` - Sample data seeder
- `jobs/capaReminder.ts` - Scheduled CAPA overdue/due-soon notifications
- `services/email.service.ts` - Email via nodemailer (SMTP config in .env)
- `services/` - Business services (email, report generation with docx/xlsx)

### Frontend (`frontend/src/`)
- `services/api.ts` - Axios instance with auth interceptor (auto-attaches JWT and `X-Project-Id` header, handles 401)
- `store/authStore.ts` - Zustand store for auth state (persisted to localStorage as `auth-storage`)
- `store/appStore.ts` - Zustand store for app state (current project selection)
- `pages/` - Full page components (Dashboard, AuditExecution, CAPAList, etc.)
- `components/ui/` - Reusable Radix-based UI components
- `lib/export.ts` - Excel/PDF export utilities using xlsx and jspdf
- `hooks/` - Custom React hooks (useDebounce, useLocalStorage, etc.)

### API Response Format
All endpoints return: `{ success: boolean, data?: any, message?: string }`

### API Base Path
All routes use `/api/v1/` prefix (not `/api/`). Health check at `/health`.

Key route modules: auth, users, packages, audit-categories, audits, capa, kpi, dashboard, reports, maturity, roles, notifications, scheduled-reports

### Frontend Routes
Protected routes wrapped in `MainLayout`. Key paths:
- `/audits`, `/audits/new`, `/audits/:id` - Audit management
- `/capa`, `/capa/open`, `/capa/overdue` - CAPA tracking
- `/kpi`, `/kpi/entry` - KPI data entry
- `/maturity`, `/maturity/:id` - Safety maturity assessments
- `/projects` - Multi-project management
- `/settings/users`, `/settings/roles` - Admin settings

## Key Business Logic

### Audit Workflow
Draft -> In Progress -> Completed -> Pending Review -> Approved

### Compliance Calculation
```
Compliance % = (Compliant Items / (Total Items - NA Items)) * 100
```

### KPI Formulas
- LTIFR = (Lost Time Injuries x 1,000,000) / Man-hours
- TRIFR = (Total Recordable Injuries x 1,000,000) / Man-hours

## User Roles (hierarchical permissions)
Super Admin > PMC Head > Package Manager > Auditor > Contractor > Viewer

## Test Credentials (after seeding)
- admin@protecther.in / admin123 (Super Admin)
- pmchead@protecther.com / demo123 (PMC Head)
- manager.c2@protecther.com / demo123 (Package Manager)
- auditor1@protecther.com / demo123 (Auditor)

## Environment Setup

Backend requires `backend/.env` (copy from `.env.example`):
- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
- JWT_SECRET, JWT_EXPIRES_IN
- CORS_ORIGIN (comma-separated for multiple origins)
- EMAIL_ENABLED, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (for CAPA notifications)

Frontend uses `VITE_API_URL` env var (defaults to `/api/v1`).

## Deployment

### Production URLs
- **Frontend**: https://audit.protecther.in
- **API**: https://api-audit.protecther.in

### Infrastructure
- Hosted on Windows machine with Cloudflare Tunnel
- Tunnel config: `C:\Users\IT\.cloudflared\config.yml`
- Tunnel name: `protecther-audit`

### Startup/Shutdown Scripts
```bash
start-protecther.bat          # Start backend, frontend, and tunnel
stop-protecther.bat           # Stop all services
```

### Database Backup
```bash
backup-database.bat           # Manual backup to backups/ folder
setup-backup-scheduler.bat    # Setup daily backup at 2:00 AM (run as admin)
restore-database.bat          # Restore from backup
```
- Backups stored in `C:\PROJECTS\PRO-NHRCL\backups\`
- Auto-cleanup: backups older than 7 days are deleted

### Auto-Start on Boot
Run `create-startup-shortcut.vbs` to add startup shortcut to Windows Startup folder.

### Adding New Subdomains
```bash
cloudflared tunnel route dns protecther-audit <subdomain>.protecther.in
```

## Conventions

- Protected routes require JWT in `Authorization: Bearer <token>` header
- Multi-project support: Frontend sends `X-Project-Id` header with requests
- File uploads stored in `backend/uploads/`
- Audit categories are seeded (18 categories covering statutory, technical, and safety areas)
- Path aliases: Frontend uses `@/*` for `src/*`, Backend uses `@/*` for `src/*`

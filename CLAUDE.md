# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PROTECTHER Audit Panel - A full-stack web application for managing construction safety audits. PROTECTHER is a safety auditing organization that conducts audits for multiple client projects. This platform tracks audit compliance, KPIs (LTIFR, TRIFR), CAPA management, and safety maturity assessments across project packages.

## Tech Stack

- **Backend**: Node.js 18+, Express, TypeScript, PostgreSQL 15+, JWT auth, Winston logging, nodemailer
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand (state), React Query, Radix UI, Recharts

## Commands

### Development
```bash
npm install               # Install all dependencies (both workspaces)
npm run dev               # Start both frontend (port 3000) and backend (port 5000)
npm run dev:frontend      # Frontend only
npm run dev:backend       # Backend only
```

### Database
```bash
npm run db:migrate        # Run migrations (backend workspace)
npm run db:seed           # Seed sample data (roles, users, categories, sample audits)
npm run cleanup --workspace=backend   # Clean up duplicate records
npm run backup --workspace=backend    # Backup database
```

Migrations are in `backend/src/database/migrations/`. Schema is defined in `migrate.ts`.

### Build & Lint
```bash
npm run build             # Build both workspaces
npm run lint --workspace=frontend    # Lint frontend
npm run lint --workspace=backend     # Lint backend
npm run preview --workspace=frontend # Preview production build
```

### Testing
```bash
# Frontend (Vitest)
npm run test --workspace=frontend           # Run all tests
npm run test:ui --workspace=frontend        # Interactive UI
npm run test:coverage --workspace=frontend  # Coverage report
npx vitest run frontend/src/path/to/file.test.ts  # Single file (from root)

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

### Database Schema (PostgreSQL)

**Core Tables:**
- `projects` - Client projects (code, name, client_name, location, status)
- `packages` - Sites within projects (project_id FK, code, name, contractor_name)
- `users` - Auth & profile (email, password_hash, role_id FK, package_id FK, reset_token)
- `roles` - 6 roles with JSONB permissions
- `user_project_assignments` - Many-to-many user↔project with is_default flag

**Audit System:**
- `audit_categories` - 28 categories (MAHSR V5 checklist: Statutory, SHE, HIRA, Permits, Scaffolding … Rigging, Casting, PT Strand, RMC, Reinforcement, Shuttering). Loaded from the MAHSR workbook via `reload-checklist.ts`, NOT seeded.
- `audit_sections` - Sub-sections within categories (category_id FK)
- `audit_items` - ~871 checkpoint items (section_id FK, audit_point, priority P1/P2/P3). Per-audit ad-hoc points added by auditors are stored here with `is_custom=true` + `created_in_audit_id` (scoped to one audit; partial unique indexes let two audits reuse the same sr_no in a section).
- `audits` - Main audit record (package_id, auditor_id, status, compliance_percentage, locked_at)
- `audit_category_selection` - Many-to-many audit↔categories
- `audit_responses` - Item responses: status C/NC/NA/NV/**RM**, observation, risk_rating, capa_required. `RM` (Removed) excludes an item from that audit's reports and compliance (reversible).
- `audit_response_history` - Change tracking with old/new values, changed_by, ip_address
- `audit_evidences` - File uploads linked to responses
- `audit_comments` - Discussion threads on audits
- `audit_attachments` - Audit-level file attachments

**CAPA:**
- `capa` - Corrective/Preventive Actions (response_id FK, finding_description, root_cause, corrective_action, preventive_action, responsible_person, target_date, status, verified_by)

**KPI:**
- `kpi_indicators` - 14 indicator definitions (7 Leading, 7 Lagging) with formulas and benchmarks
- `kpi_entries` - Monthly data (package_id, indicator_id, period_month/year, target_value, actual_value, man_hours_worked, incidents_count)

**Maturity:**
- `maturity_assessments` - Assessment records (package_id, overall_score, status)
- `maturity_responses` - Question scores 1-5 with evidence, gaps, recommendations (10 dimensions, ~50 questions)

**Support:**
- `notifications` - In-app notifications with type, priority, is_read
- `audit_logs` - System audit trail with JSONB old/new values
- `scheduled_reports` / `generated_reports` - Report scheduling and history

### Backend (`backend/src/`)

```
├── index.ts                 # Express app setup, middleware, route mounting
├── controllers/             # Business logic (13 controllers)
│   ├── auth.controller.ts       # Login, logout, password reset
│   ├── audit.controller.ts      # Audit CRUD, responses, exports (largest ~71KB)
│   ├── capa.controller.ts       # CAPA CRUD, analytics, email notifications
│   ├── kpi.controller.ts        # KPI entries, trends, summary calculations
│   ├── dashboard.controller.ts  # Aggregated metrics
│   ├── maturity.controller.ts   # Assessment with hardcoded 10-dimension model
│   └── ...
├── routes/                  # Express route definitions (/api/v1/*)
├── middleware/
│   ├── auth.ts              # JWT verify, authorize(...roles), project access check
│   ├── rateLimiter.ts       # 100/min general, 5/min auth, 10/min uploads
│   ├── errorHandler.ts      # AppError class, global error handler
│   └── requestLogger.ts     # Winston request logging
├── services/
│   └── email.service.ts     # Nodemailer SMTP, CAPA notification templates
├── jobs/
│   └── capaReminder.ts      # Daily job: overdue/due-soon CAPA notifications
├── utils/
│   ├── logger.ts            # Winston config (console + file, 5MB rotation)
│   └── tokenBlacklist.ts    # In-memory revoked tokens (hourly cleanup)
└── database/
    ├── connection.ts        # PostgreSQL pool
    ├── migrate.ts           # Schema migrations
    ├── seed.ts              # Sample data
    └── migrations/          # Individual migration files
```

### Frontend (`frontend/src/`)

```
├── App.tsx                  # React Router setup, all routes
├── main.tsx                 # Entry point, QueryClientProvider
├── services/
│   ├── api.ts               # Axios instance with interceptors (JWT, X-Project-Id, 401 handler)
│   ├── audit.service.ts     # Audit CRUD, responses, evidence, Word export
│   ├── capa.service.ts      # CAPA CRUD, close
│   ├── kpi.service.ts       # KPI entries, summary
│   ├── maturity.service.ts  # Assessment CRUD
│   ├── dashboard.service.ts # Overview, KPI summary
│   ├── settings.service.ts  # Users, roles, packages, checklist CRUD
│   └── ...
├── store/
│   ├── authStore.ts         # Zustand: user, token, isAuthenticated (persisted)
│   └── appStore.ts          # Zustand: sidebarOpen, currentProject, packages, categories
├── pages/                   # 21 page components
│   ├── Dashboard.tsx        # KPI gauges, compliance charts, CAPA status, trends
│   ├── AuditList.tsx        # Filterable audit list with export
│   ├── NewAudit.tsx         # Multi-step wizard (package→type→categories→schedule)
│   ├── AuditExecution.tsx   # Main audit page: category→section→item tree, responses, evidence
│   ├── CAPAList.tsx         # CAPA management with status filters
│   ├── CAPAAnalytics.tsx    # Charts: status breakdown, trends, overdue analysis
│   ├── KPIDashboard.tsx     # Line charts, benchmarks, alerts
│   ├── KPIEntry.tsx         # Bulk monthly data entry
│   ├── MaturityAssessment.tsx # Radar chart, dimension scoring
│   └── ...
├── components/
│   ├── layout/              # MainLayout (Header+Sidebar), ProjectSelector, ProjectGuard
│   ├── audit/               # AuditComments, AuditAttachments
│   └── ui/                  # Radix-based primitives (button, dialog, table, etc.)
├── lib/
│   ├── utils.ts             # cn() helper for Tailwind classes
│   └── export.ts            # Excel (xlsx) and PDF (jspdf) export utilities
└── hooks/                   # useDebounce, useLocalStorage, etc.
```

### API Endpoints

All routes under `/api/v1/`. Health check at `/health`.

| Module | Key Endpoints |
|--------|---------------|
| **auth** | POST login, logout, refresh, forgot-password, reset-password |
| **users** | GET/PUT /me, CRUD /users, pagination & filtering |
| **projects** | CRUD, GET /:id/users, POST /:id/users, POST /:id/set-default |
| **packages** | CRUD, GET /:id/audits, GET /:id/kpis |
| **audits** | CRUD, POST /:id/submit, /:id/approve, /:id/reject |
| | GET/POST /:id/responses, GET /:id/history |
| | GET/POST /:id/comments, GET/POST /:id/attachments |
| | GET /:id/export-word, /:id/export-nc-report |
| | POST /responses/:id/evidence |
| **audit-categories** | CRUD categories, sections, items |
| **capa** | CRUD, GET /analytics, POST /:id/close |
| **kpi** | GET /indicators, /summary, /trends, CRUD /entries |
| **dashboard** | GET /overview, /project-comparison, /package/:id, /kpi-summary |
| **maturity** | GET /model, CRUD assessments, PUT /:id/responses, POST /:id/submit |
| **roles** | CRUD with permission matrix |
| **notifications** | GET list, PUT /:id/read, PUT /mark-all-read, DELETE |
| **reports** | GET compliance-summary, nc-summary, capa-status, trend-analysis, POST /export |
| **scheduled-reports** | CRUD, POST /:id/toggle, /:id/run, /generate |

### API Response Format
```json
{ "success": boolean, "data": T, "message"?: string }
// Paginated:
{ "success": true, "data": [], "total": n, "page": n, "pageSize": n, "totalPages": n }
```

### Frontend Routes

Protected routes wrapped in `MainLayout`. Key paths:
- `/` - Dashboard
- `/audits`, `/audits/new`, `/audits/:id` - Audit management
- `/capa`, `/capa/analytics`, `/capa/open`, `/capa/overdue` - CAPA tracking
- `/kpi`, `/kpi/dashboard`, `/kpi/entry` - KPI data
- `/maturity`, `/maturity/:id` - Safety maturity assessments
- `/projects`, `/projects/:id/settings` - Multi-project management
- `/settings/users`, `/settings/roles`, `/settings/checklist` - Admin settings
- `/profile` - User profile

## Business Logic

### Audit Workflow
```
Draft → In Progress → Pending Review → Approved (locked)
                                    → Rejected (return to auditor)
```
- On submit: validates NC items have evidence, auto-creates CAPAs for NC+capa_required
- On approve: sets `locked_at` timestamp, no further edits allowed
- Audit number format: `AUD-{PACKAGE_CODE}-{YEAR}-{SEQ}`

### Compliance Calculation
```
Compliance % = Compliant / (Compliant + Non-Compliant) × 100
```
NA, NV, and RM (Removed) items are excluded from the denominator. RM items are also hidden from Word/PDF exports.

### CAPA Workflow
```
Open → In Progress → Closed (with verification)
```
- Auto-created from NC audit responses with `capa_required=true`
- CAPA number format: `CAPA-{YEAR}-{SEQ}`
- Fields: finding_description, root_cause, corrective_action, preventive_action, responsible_person, target_date

### CAPA Reminder Job (`jobs/capaReminder.ts`)
- Runs every 24 hours (starts on server boot)
- Checks for overdue CAPAs (target_date < today, status != Closed)
- Checks for due-soon CAPAs (due within 3 days)
- Sends in-app notifications + emails to Package Managers

### KPI Formulas
- **LTIFR** = (Lost Time Injuries × 1,000,000) / Man-hours
- **TRIFR** = (Total Recordable Injuries × 1,000,000) / Man-hours
- Leading indicators: Safety Inspections, Hazard Reports, Near Miss, TBT Attendance, PTW Compliance, CAPA Closure Rate
- Lagging indicators: LTIFR, TRIFR, Fatality Rate, Severity Rate, Man-hours, Days Without LTI

### Maturity Assessment
- 10 dimensions: Leadership, Policy, Organization, Risk Management, Competence, Communication, Operational Control, Emergency, Incident Management, Performance
- 5-level scoring: 1=Initial, 2=Developing, 3=Defined, 4=Managed, 5=Optimized
- ~50 questions total, radar chart visualization

## Authentication & Authorization

### JWT Auth
- Token in `Authorization: Bearer <token>` header
- 24h expiry (configurable via JWT_EXPIRES_IN)
- Logout adds token to in-memory blacklist (hourly cleanup)
- Password reset via email token (1-hour expiry)

### Role Hierarchy (6 roles)
1. **Super Admin** - Full system access, sees all projects
2. **PMC Head** - Project oversight, can approve audits
3. **Package Manager** - Package-level access, CAPA management
4. **Auditor** - Conduct audits
5. **Contractor** - Limited data access
6. **Viewer** - Read-only

### Multi-Project Support
- Frontend sends `X-Project-Id` header with every request
- Users assigned to projects via `user_project_assignments` table
- Each user has one default project (`is_default=true`)
- Super Admin sees all projects; others filtered by assignment

## Rate Limiting
- General API: 100 requests/minute
- Auth endpoints: 5 requests/minute
- File uploads: 10 requests/minute

## Test Credentials (after seeding)
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@protecther.in | admin123 |
| PMC Head | pmchead@protecther.com | demo123 |
| Package Manager | manager.c2@protecther.com | demo123 |
| Auditor | auditor1@protecther.com | demo123 |

## Environment Setup

Backend requires `backend/.env` (copy from `.env.example`):
```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=protecther_audit
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# CORS (comma-separated for multiple origins)
CORS_ORIGIN=http://localhost:3000

# Email (for CAPA notifications)
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=PROTECTHER Audit Panel <noreply@protecther.com>

# App
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:3000
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

Frontend uses `VITE_API_URL` env var (defaults to `/api/v1`).

### Secrets & Database Roles

- **`backend/.env` is the single source of secrets** (DB password, JWT secret, SMTP).
  It is gitignored and **must never be committed**. On the prod host it is ACL-locked to
  the run-as account + SYSTEM only (`icacls .env /grant "<host>\IT:(M)"` and SYSTEM:(F),
  inheritance removed). The run-as account MUST retain at least read — if only SYSTEM has
  access the backend can't read its own `.env` and fails to start.
- **Least-privilege app role**: the app connects as `protecther_app` (NOT the `postgres`
  superuser). This role has DML only — `SELECT/INSERT/UPDATE/DELETE` on tables and
  `USAGE/SELECT/UPDATE` on sequences, plus `ALTER DEFAULT PRIVILEGES` so new tables inherit
  the grants. It has **no DDL/CREATE** (`CREATE ON SCHEMA public` is revoked from PUBLIC).
- **Migrations and `reload-checklist.ts` run as `postgres`** (they need DDL/TRUNCATE), not
  as the app role. Set `DB_USER=postgres` (and its password) in the shell for those runs.
- **`.pgpass`** (`%APPDATA%\postgresql\pgpass.conf`) holds the postgres + app passwords for
  CLI tools (pg_dump/psql in the .bat scripts); it is ACL-locked to the owner.
- Rotating secrets: update `backend/.env` (+ `.pgpass` if the DB password changed), then
  restart backend. Rotating `JWT_SECRET` invalidates all existing tokens — **all users must
  re-login**.

## Deployment

### Production URLs
- **Frontend**: https://audit.protecther.in (local :3000)
- **API**: https://api-audit.protecther.in (local :5000)

### Staging URLs
- **Frontend**: https://staging-audit.protecther.in (local :3001)
- **API**: https://staging-api-audit.protecther.in (local :5001)
- Staging runs from the **current working tree** (whatever branch is checked out) via
  `start-staging.bat`, against a separate DB `mahsr_safety_staging`, so changes can be
  tested through the real tunnel before merging/deploying to prod.
- `refresh-staging.bat` rebuilds `mahsr_safety_staging` as a fresh copy of production
  (dump prod → drop+recreate staging → restore). Rebuild the staging frontend after a
  UI change: `cd frontend && npx vite build --mode staging --outDir dist-staging --emptyOutDir`
  (uses `frontend/.env.staging`, which points at the staging API hostname — no secrets).

### Infrastructure
- Hosted on Windows machine with Cloudflare Tunnel
- Tunnel config: `C:\Users\IT\.cloudflared\config.yml` (ingress for all 4 hostnames above)
- Tunnel name: `mahsr-safety`

### Startup/Shutdown Scripts
```bash
start-protecther.bat          # Manual BUILD + (re)start of backend (:5000) + frontend (:3000)
                              #   after a deploy. Does NOT start the tunnel (it's a service).
boot-start.bat                # Headless start of the ALREADY-BUILT app (no build); used by the
                              #   PROTECTHER-AutoStart task at boot. Waits for Postgres, idempotent.
stop-protecther.bat           # Stop backend/frontend node procs + the cloudflared service
restart-backend.ps1           # (admin) Restart ONLY the backend to reload backend/.env
                              #   (e.g. after changing email/SMTP). Frontend + tunnel untouched.
start-staging.bat             # Start staging backend (:5001) + frontend (:3001) from working tree
refresh-staging.bat           # Rebuild staging DB as a fresh copy of production
```

### Database Backup
```bash
backup-database.bat           # Backup mahsr_safety to backups/ (custom-format .dump)
restore-database.bat <file> [target_db]   # Restore a .dump/.sql; optional throwaway target
```
- Both scripts run as the **`postgres`** superuser (backup must be complete; restore needs
  DDL). The password comes from `pgpass.conf` via `PGPASSFILE` (the absolute IT-profile path
  is hardcoded so it also works when run as SYSTEM). The app role `protecther_app` is NOT used.
- Backups stored in `C:\PROJECTS\PRO-NHRCL\backups\` as `mahsr_safety_<timestamp>.dump`.
- Retention: routine dumps older than 7 days are auto-deleted; **manual `*_PRE_*.dump` safety
  dumps are kept indefinitely** (the cleanup mask only matches year-prefixed routine files).
- Restore a dump into a throwaway DB to verify it (does not touch prod):
  `restore-database.bat mahsr_safety_<ts>.dump mahsr_safety_restoretest`
- **Off-site copy:** each dump is also copied to `\\PLLP_NAS\Protecther\IT\PROTECTHER-Audit-Backups`
  (30-day retention there) so a local disk loss doesn't take the backups with it.
- Daily backup runs via the `PROTECTHER-Database-Backup` scheduled task (02:00), installed by
  `setup-autostart.ps1`. GOTCHA: the NAS copy only works when the task runs as the **IT user**
  (SYSTEM reaches the network as the machine account, which the NAS share rejects). Run
  **`set-backup-account.ps1`** as admin (prompts for the IT Windows password once) to switch the
  task to the IT account; it then test-runs and confirms a file lands on the NAS.

### Auto-Start on Boot
`setup-autostart.ps1` (run ONCE, as Administrator) makes the stack survive an unattended
reboot — no interactive login required:
- **cloudflared** is installed as a Windows **service** (LocalSystem, Automatic). GOTCHA:
  cloudflared's bare `service install` registers the exe with NO arguments, so the service
  never runs the tunnel → all hostnames return **Cloudflare 530**. The service command line
  MUST be `cloudflared.exe --config C:\Users\IT\.cloudflared\config.yml tunnel run` (set via
  `sc config Cloudflared binPath= ...`). `setup-autostart.ps1` now enforces this. If the
  service is broken/stuck "Stop Pending", run **`fix-cloudflared-service.ps1`** as admin — it
  force-kills the hung process, applies the correct binPath, and verifies the site serves 200
  before stopping any fallback tunnel. (`boot-start.bat` also starts the tunnel as a fallback
  if the service isn't running, so a reboot still comes up.)
- **`PROTECTHER-AutoStart`** scheduled task runs `boot-start.bat` **At startup** as the `IT`
  account with **S4U logon** ("run whether logged on or not", no stored password, local
  resources only — which is all the app needs). 30s start delay + restart-on-failure.
- **`PROTECTHER-Database-Backup`** task (daily 02:00, SYSTEM) — see above.
- It also removes the old login-only Startup-folder shortcuts so the app isn't double-launched.

Verify after a reboot: `Get-Service cloudflared`, `Get-ScheduledTask PROTECTHER-AutoStart`,
and `Get-Content logs\boot.log -Tail 6`. (The legacy `create-startup-shortcut.vbs` /
`setup-backup-scheduler.bat` are superseded by `setup-autostart.ps1`.)

### Adding New Subdomains
```bash
cloudflared tunnel route dns mahsr-safety <subdomain>.protecther.in
```

## Conventions

- All API routes use `/api/v1/` prefix
- Protected routes require JWT in `Authorization: Bearer <token>` header
- Multi-project: Frontend sends `X-Project-Id` header with requests
- File uploads stored in `backend/uploads/` (images, PDFs, docs up to 10MB)
- Audit checklist (28 categories / ~871 items) is loaded from the MAHSR V5 workbook via `npx ts-node src/database/reload-checklist.ts` (clean reload). `seed.ts` does NOT seed the checklist.
- Auditors can add ad-hoc checkpoints during an audit (`POST/PUT/DELETE /audits/:id/custom-items`, shown as "Added") and exclude items with the RM status — both scoped to a single audit
- Path aliases: Frontend uses `@/*` for `src/*`, Backend uses `@/*` for `src/*`
- Passwords hashed with bcryptjs (salt: 12)
- All delete operations are soft deletes (status='Deleted' or is_active=false)
- Audit responses auto-save with change history tracking
- React Query polling: Dashboard 60s, Notifications 30s

# NHSRCL Safety Audit Management System - Project Context

## Overview
This is a full-stack web application for managing safety audits for NHSRCL (National High Speed Rail Corporation Limited) / MAHSR (Mumbai-Ahmedabad High Speed Rail) project. The system enables safety compliance tracking, audit management, KPI monitoring, and CAPA (Corrective and Preventive Action) management.

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **File Uploads**: Multer

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **UI Components**: Custom components with Radix UI primitives
- **HTTP Client**: Axios

## Project Structure

```
nhsrcl/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Route handlers
│   │   ├── database/         # DB connection, migrations, seeds
│   │   ├── middleware/       # Auth, error handling, logging
│   │   ├── routes/           # API route definitions
│   │   ├── utils/            # Logger and utilities
│   │   └── index.ts          # Server entry point
│   ├── uploads/              # File upload directory
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── layout/       # Header, Sidebar, MainLayout
│   │   │   └── ui/           # Button, Card, Input, etc.
│   │   ├── pages/            # Page components
│   │   ├── services/         # API service functions
│   │   ├── store/            # Zustand state stores
│   │   ├── types/            # TypeScript type definitions
│   │   ├── lib/              # Utility functions
│   │   ├── App.tsx           # Main app with routing
│   │   └── main.tsx          # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── package.json              # Root package.json (workspace)
└── CLAUDE.md                 # This file
```

## Core Features

### 1. User Management & Authentication
- Role-based access control (Super Admin, PMC Head, Package Manager, Auditor, Contractor, Viewer)
- JWT-based authentication
- User profiles with package assignments

### 2. Audit Management
- Create, edit, and conduct safety audits
- 18 audit categories covering statutory compliance, safety systems, and technical areas
- Audit workflow: Draft → In Progress → Completed → Pending Review → Approved
- Audit responses: Compliant (C), Non-Compliant (NC), Not Applicable (NA)

### 3. CAPA Management
- Automatic CAPA generation for non-compliant items
- Track corrective and preventive actions
- CAPA workflow: Open → In Progress → Closed

### 4. KPI Tracking
- Leading indicators (proactive metrics)
- Lagging indicators (incident rates like LTIFR, TRIFR)
- Monthly data entry per package
- Dashboard visualizations

### 5. Reporting
- Audit reports with compliance percentages
- KPI trend analysis
- Package-wise comparisons
- Export to Excel/PDF

### 6. Maturity Assessment
- Safety maturity level evaluation
- Scoring across multiple dimensions

## Database Schema (Key Tables)

- `users` - User accounts with roles
- `roles` - Role definitions with permissions (JSON)
- `packages` - Construction packages (C1-C7)
- `audit_categories` - 18 safety audit categories
- `audit_sections` - Sections within categories
- `audit_items` - Individual audit checkpoints
- `audits` - Audit records
- `audit_responses` - Responses to audit items
- `capa` - Corrective/Preventive actions
- `kpi_indicators` - KPI definitions
- `kpi_entries` - Monthly KPI data entries

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Audits
- `GET /api/audits` - List audits
- `POST /api/audits` - Create audit
- `GET /api/audits/:id` - Get audit details
- `PUT /api/audits/:id` - Update audit
- `POST /api/audits/:id/responses` - Save audit responses
- `PUT /api/audits/:id/submit` - Submit for review
- `PUT /api/audits/:id/approve` - Approve audit

### CAPA
- `GET /api/capa` - List CAPAs
- `POST /api/capa` - Create CAPA
- `PUT /api/capa/:id` - Update CAPA

### KPI
- `GET /api/kpi/indicators` - List KPI indicators
- `GET /api/kpi/entries` - Get KPI entries
- `POST /api/kpi/entries` - Save KPI entry

### Dashboard
- `GET /api/dashboard/summary` - Dashboard statistics
- `GET /api/dashboard/trends` - Trend data

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials
npm install
npm run migrate    # Run database migrations
npm run seed       # Seed sample data
npm run dev        # Start development server (port 5000)
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev        # Start Vite dev server (port 3000)
```

### Test Credentials (after seeding)
| Email | Password | Role |
|-------|----------|------|
| admin@mahsr.com | admin123 | Super Admin |
| pmchead@mahsr.com | demo123 | PMC Head |
| manager.c2@mahsr.com | demo123 | Package Manager |
| auditor1@mahsr.com | demo123 | Auditor |

## Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mahsr_safety
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
```

## Key Business Logic

### Audit Compliance Calculation
```
Compliance % = (Compliant Items / (Total Items - NA Items)) * 100
```

### KPI Formulas
- **LTIFR** = (Lost Time Injuries × 1,000,000) / Man-hours worked
- **TRIFR** = (Total Recordable Injuries × 1,000,000) / Man-hours worked
- **Severity Rate** = (Lost Days × 1,000,000) / Man-hours worked

## Audit Categories (18 total)
1. Statutory & Legal Compliance
2. SHE Management System
3. HIRA & Risk Control
4. Work Permits & LOTO
5. Scaffolding & Work at Height
6. Excavation & Earthwork
7. Tunneling Safety
8. Lifting & Cranes
9. Electrical Safety
10. Fire & Emergency
11. PPE & Worker Welfare
12. Training & Competency
13. Working Near IR Track
14. Formwork & Temp Structures
15. Bridge & Viaduct Works
16. Plant & Machinery
17. Material Handling
18. Incident Management

## Common Tasks

### Adding a New Audit Category
1. Add to `seed.ts` in audit_categories insert
2. Create sections and items for the category
3. Re-run seed or create migration

### Adding a New KPI Indicator
1. Add to `kpi_indicators` table via seed or migration
2. Update frontend KPI entry form if needed

### Adding a New User Role
1. Add role to `roles` table with permissions JSON
2. Update middleware auth checks if needed
3. Update frontend route guards

## Notes for AI Assistants

- This is a safety-critical application; data integrity is important
- Follow existing patterns for new features
- Use TypeScript types consistently
- API responses follow `{ success: boolean, data?: any, message?: string }` format
- All protected routes require JWT token in Authorization header
- File uploads go to `backend/uploads/` directory

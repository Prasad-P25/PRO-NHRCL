# PROTECTHER Audit Panel

Construction Safety Audit Management System by PROTECTHER

## Overview

A comprehensive web-based safety audit management portal that enables multiple auditors to conduct safety audits simultaneously across different project sites and packages. This system provides a modern, scalable solution for construction safety compliance management.

## Features

- **Multi-Project Support**: Manage audits across multiple client projects
- **Multi-user Audit Execution**: Concurrent audit execution across project packages
- **22 Audit Categories**: 600+ checkpoint items covering statutory compliance, technical audits, and KPIs
- **Role-Based Access Control**: Super Admin, PMC Head, Package Manager, Auditor, Contractor, Viewer
- **KPI Tracking**: Leading and Lagging safety indicators (LTIFR, TRIFR)
- **CAPA Management**: Corrective and Preventive Actions tracking
- **Safety Maturity Assessment**: 5-level maturity model
- **Real-time Dashboards**: Compliance metrics and trend analysis
- **Evidence Management**: Photo and document attachments
- **Offline Capability**: PWA support for field audits

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- React Query + Zustand
- React Router
- Recharts

### Backend
- Node.js + Express
- TypeScript
- PostgreSQL
- JWT Authentication
- Multer (file uploads)

## Project Structure

```
protecther-audit/
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API services
│   │   ├── store/      # State management
│   │   ├── types/      # TypeScript types
│   │   └── lib/        # Utilities
│   └── ...
├── backend/            # Express backend API
│   ├── src/
│   │   ├── controllers/ # Route controllers
│   │   ├── routes/      # API routes
│   │   ├── middleware/  # Express middleware
│   │   ├── database/    # DB connection & migrations
│   │   └── utils/       # Utilities
│   └── ...
└── docs/              # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### Installation

1. Clone the repository:
```bash
cd C:\Projects\PRO-NHRCL
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials
```

4. Set up the database:
```bash
# Create database
createdb protecther_audit

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

5. Start development servers:
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Demo Login

Use these credentials to test the application:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@protecther.com | admin123 |
| PMC Head | pmchead@protecther.com | demo123 |
| Package Manager | manager.c2@protecther.com | demo123 |
| Auditor | auditor1@protecther.com | demo123 |

## API Documentation

Base URL: `/api/v1`

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh token

### Audits
- `GET /audits` - List audits
- `POST /audits` - Create audit
- `GET /audits/:id` - Get audit details
- `POST /audits/:id/submit` - Submit for review
- `POST /audits/:id/approve` - Approve audit

### CAPA
- `GET /capa` - List CAPA items
- `POST /capa` - Create CAPA
- `POST /capa/:id/close` - Close CAPA

### KPI
- `GET /kpi/indicators` - List KPI indicators
- `GET /kpi/entries` - Get KPI entries
- `POST /kpi/entries` - Save KPI entry

### Dashboard
- `GET /dashboard/overview` - Get dashboard data
- `GET /dashboard/kpi-summary` - Get KPI summary

## Audit Categories

1. Statutory Compliance
2. SHE Management System
3. HIRA & Risk Control
4. Work Permits & LOTO
5. Scaffolding & Height
6. Excavation & Earthwork
7. Tunneling Safety
8. Lifting & Cranes
9. Electrical Safety
10. Fire & Emergency
11. PPE & Welfare
12. Training & Competency
13. Working Near IR Track
14. Formwork & Temp Structures
15. Bridge & Viaduct Works
16. Plant & Machinery
17. Material Handling
18. Incident Management

## License

Proprietary - PROTECTHER

## Support

For issues and feature requests, contact the development team.

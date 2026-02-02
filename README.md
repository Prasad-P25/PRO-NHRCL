# MAHSR Safety Audit Portal

Mumbai-Ahmedabad High Speed Rail (MAHSR) Project - Safety Audit Management System

## Overview

A comprehensive web-based safety audit management portal that enables multiple auditors to conduct safety audits simultaneously across different project sites and packages. This system replaces the Excel-based audit checklist (MAHSR_V5.xlsx) with a modern, scalable solution.

## Features

- **Multi-user Audit Execution**: Concurrent audit execution across 7 packages
- **22 Audit Categories**: 600+ checkpoint items covering statutory compliance, technical audits, and KPIs
- **Role-Based Access Control**: Super Admin, PMC Head, Package Manager, Auditor, Contractor, Viewer
- **KPI Tracking**: Leading and Lagging safety indicators
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
nhsrcl/
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
├── database/           # Database scripts
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
cd C:\Projects\nhsrcl
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
createdb mahsr_safety

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
| Admin | admin@mahsr.com | admin123 |
| PMC Head | pmchead@mahsr.com | demo123 |
| Package Manager | manager.c2@mahsr.com | demo123 |
| Auditor | auditor1@mahsr.com | demo123 |

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

## Packages/Sites

| Code | Name | Location |
|------|------|----------|
| C1 | Vadodara Corridor | Vadodara, Gujarat |
| C2 | BKC Underground | Mumbai, Maharashtra |
| C3 | Thane Region | Thane, Maharashtra |
| C4 | Gujarat Corridor North | Anand-Vadodara |
| C5 | Gujarat Corridor South | Surat Region |
| C6 | Surat Region | Surat, Gujarat |
| C7 | Ahmedabad Terminal | Ahmedabad, Gujarat |

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

Proprietary - NHSRCL / MAHSR Project

## Support

For issues and feature requests, contact the development team.

# PROTECTHER Audit Panel - Deployment Guide

## Production URLs
- **Frontend:** https://audit.protecther.in
- **API:** https://api-audit.protecther.in

---

## Pre-Deployment Checklist

### 1. Environment Configuration

- [x] `backend/.env` - `NODE_ENV=production`
- [x] `backend/.env` - `APP_URL=https://audit.protecther.in`
- [x] `backend/.env` - Email settings added (disabled by default)
- [x] `frontend/.env` - `VITE_API_URL=https://api-audit.protecther.in/api/v1`

### 2. Email Setup (Optional)

To enable password reset and CAPA notification emails, update `backend/.env`:

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=PROTECTHER Audit Panel <noreply@protecther.com>
```

**Note:** For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833), not your regular password.

### 3. Database

- [x] PostgreSQL 17 installed
- [x] Database `mahsr_safety` created
- [x] Migrations applied (`npm run db:migrate`)
- [x] Seed data applied (`npm run db:seed`)
- [x] Daily backups scheduled (2:00 AM)

### 4. Infrastructure

- [x] Cloudflare Tunnel configured (`mahsr-safety`)
- [x] Tunnel routes: `audit.protecther.in`, `api-audit.protecther.in`
- [x] Startup scripts ready
- [x] Auto-start shortcut available

---

## Deployment Steps

### First Time Setup

```bash
# 1. Install dependencies
cd C:\PROJECTS\PRO-NHRCL
npm install

# 2. Run database migrations
npm run db:migrate

# 3. Seed initial data (roles, users, categories)
npm run db:seed

# 4. Set up daily backup scheduler (run as Administrator)
setup-backup-scheduler.bat

# 5. Create startup shortcut (optional - for auto-start on boot)
cscript create-startup-shortcut.vbs
```

### Starting Services

```bash
# Start all services (backend, frontend, tunnel)
start-protecther.bat
```

This will:
1. Build the backend (TypeScript → JavaScript)
2. Start the backend server on port 5000
3. Build the frontend (Vite production build)
4. Serve the frontend on port 3000
5. Start Cloudflare Tunnel

### Stopping Services

```bash
stop-protecther.bat
```

---

## Manual Backup

```bash
backup-database.bat
```

Backups are stored in `C:\PROJECTS\PRO-NHRCL\backups\` and auto-cleaned after 7 days.

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@protecther.in | admin123 |
| PMC Head | pmchead@protecther.com | demo123 |
| Package Manager | manager.c2@protecther.com | demo123 |
| Auditor | auditor1@protecther.com | demo123 |

---

## Troubleshooting

### Backend won't start
- Check if PostgreSQL is running
- Verify database credentials in `backend/.env`
- Check port 5000 is available

### Frontend won't build
- Run `npm install` in project root
- Check Node.js version >= 18

### Tunnel not connecting
- Verify `cloudflared.exe` path in `start-protecther.bat`
- Check tunnel configuration: `cloudflared tunnel info mahsr-safety`

### CORS errors
- Verify `CORS_ORIGIN` in `backend/.env` includes all required domains

---

## Security Notes

- [ ] Change default passwords after first login
- [ ] Keep `.env` files secure (not in git)
- [ ] Regularly update dependencies (`npm audit fix`)
- [ ] Monitor logs in `backend/logs/`

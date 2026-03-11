# PROTECTHER Audit Panel - Testing Plan

**URL**: https://audit.protecther.in
**API**: https://api-audit.protecther.in

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@protecther.in | admin123 |
| PMC Head | pmchead@protecther.com | demo123 |
| Package Manager | manager.c2@protecther.com | demo123 |
| Auditor | auditor1@protecther.com | demo123 |

---

## Phase 1: Authentication & Login

### 1.1 Login Page
- [x] Open https://audit.protecther.in
- [x] Verify login page loads correctly
- [x] Try login with wrong password → Should show error
- [ ] Try login with non-existent email → Should show error
- [ ] Login with `admin@protecther.in` / `admin123` → Should redirect to Dashboard

### 1.2 Session Management
- [ ] After login, refresh page → Should stay logged in
- [ ] Open new tab, go to site → Should be logged in
- [ ] Click Logout → Should redirect to login page
- [ ] Try accessing dashboard URL directly after logout → Should redirect to login

---

## Phase 2: Dashboard

### 2.1 Dashboard Overview
- [ ] Dashboard loads without errors
- [ ] Verify compliance percentage displays
- [ ] Verify KPI cards show data (LTIFR, TRIFR)
- [ ] Verify recent audits list shows
- [ ] Verify CAPA status summary shows
- [ ] Charts/graphs render correctly

---

## Phase 3: Project Management

### 3.1 View Projects
- [ ] Go to Projects page
- [ ] Verify project list displays
- [ ] Check project cards show correct info

### 3.2 Create New Project
- [ ] Click "New Project" or "+" button
- [ ] Fill in project details (name, description, dates)
- [ ] Submit → Project should appear in list
- [ ] Open created project → Details should match

### 3.3 Switch Between Projects
- [ ] Use project selector/dropdown
- [ ] Switch to different project
- [ ] Verify dashboard data changes for selected project

---

## Phase 4: Package Management

### 4.1 View Packages
- [ ] Go to Packages page
- [ ] Verify packages list for current project

### 4.2 Create/Edit Package
- [ ] Create a new package
- [ ] Edit existing package
- [ ] Verify changes saved

---

## Phase 5: Audit Management (Core Feature)

### 5.1 View Audits
- [ ] Go to Audits page
- [ ] Verify audit list displays
- [ ] Check filters work (by status, date, package)
- [ ] Search functionality works

### 5.2 Create New Audit
- [ ] Click "New Audit"
- [ ] Select Package
- [ ] Select Audit Category
- [ ] Set audit date
- [ ] Submit → Audit created with "Draft" status

### 5.3 Execute Audit
- [ ] Open a draft audit
- [ ] For each checklist item:
  - [ ] Mark as Compliant / Non-Compliant / NA
  - [ ] Add observations/comments
  - [ ] Upload evidence photo (if applicable)
- [ ] Save progress → Should auto-save or have save button
- [ ] Close and reopen → Progress should be saved

### 5.4 Audit Workflow
- [ ] Draft → Click "Start" → Status changes to "In Progress"
- [ ] In Progress → Complete all items → Click "Complete"
- [ ] Completed → Click "Submit for Review" → Status "Pending Review"
- [ ] Pending Review → (As PMC Head/Admin) Click "Approve" → Status "Approved"

### 5.5 View Audit Report
- [ ] Open completed/approved audit
- [ ] View audit summary/report
- [ ] Check compliance score calculation
- [ ] Export to PDF (if available)

---

## Phase 6: CAPA Management

### 6.1 View CAPAs
- [ ] Go to CAPA page
- [ ] Verify CAPA list displays
- [ ] Check filters (Open, Closed, Overdue)
- [ ] Verify overdue CAPAs highlighted

### 6.2 CAPA from Audit Finding
- [ ] In audit execution, mark item as Non-Compliant
- [ ] CAPA should be auto-created or option to create
- [ ] Verify CAPA linked to audit finding

### 6.3 CAPA Details
- [ ] Open a CAPA
- [ ] View finding description
- [ ] View/set target date
- [ ] Assign responsibility
- [ ] Add corrective action details

### 6.4 Close CAPA
- [ ] Add closure evidence/comments
- [ ] Upload evidence photo
- [ ] Click "Close CAPA"
- [ ] Verify status changes to Closed

### 6.5 CAPA Analytics
- [ ] Go to CAPA Analytics page
- [ ] Verify charts display
- [ ] Check CAPA aging analysis
- [ ] Check CAPA by category breakdown

---

## Phase 7: KPI Management

### 7.1 KPI Dashboard
- [ ] Go to KPI Dashboard
- [ ] Verify LTIFR and TRIFR display
- [ ] Check trend charts
- [ ] Verify leading indicators show

### 7.2 KPI Data Entry
- [ ] Go to KPI Entry page
- [ ] Select month/period
- [ ] Enter man-hours worked
- [ ] Enter injury counts (LTI, TRI, etc.)
- [ ] Save data
- [ ] Verify KPI calculations update

---

## Phase 8: Safety Maturity Assessment

### 8.1 View Assessments
- [ ] Go to Maturity page
- [ ] View list of assessments

### 8.2 Create Assessment
- [ ] Start new assessment
- [ ] Rate each maturity element (Level 1-5)
- [ ] Add comments/observations
- [ ] Submit assessment
- [ ] View maturity spider/radar chart

---

## Phase 9: Reports

### 9.1 Generate Reports
- [ ] Go to Reports page
- [ ] Select report type (Audit Summary, CAPA Status, KPI Report)
- [ ] Set date range
- [ ] Generate report
- [ ] View report preview

### 9.2 Export Reports
- [ ] Export to PDF
- [ ] Export to Excel
- [ ] Verify downloaded file opens correctly

---

## Phase 10: User Management (Admin Only)

### 10.1 View Users
- [ ] Go to Settings → Users
- [ ] Verify user list displays
- [ ] Check user details (name, email, role, package)

### 10.2 Create New User
- [ ] Click "Add User"
- [ ] Fill in: Name, Email, Password, Role, Package
- [ ] Submit → User created
- [ ] Logout and login as new user → Should work

### 10.3 Edit User
- [ ] Edit existing user's role
- [ ] Save changes
- [ ] Verify new permissions take effect

### 10.4 Deactivate User
- [ ] Deactivate a user
- [ ] Try login as that user → Should be blocked

---

## Phase 11: Role-Based Access Control

### 11.1 Test as Auditor
- [ ] Login as `auditor1@protecther.com`
- [ ] Can view/execute audits in assigned package
- [ ] Cannot access User Management
- [ ] Cannot approve audits

### 11.2 Test as Package Manager
- [ ] Login as `manager.c2@protecther.com`
- [ ] Can manage audits in their package
- [ ] Can close CAPAs
- [ ] Cannot access other packages

### 11.3 Test as PMC Head
- [ ] Login as `pmchead@protecther.com`
- [ ] Can view all packages
- [ ] Can approve audits
- [ ] Can view reports across packages

---

## Phase 12: Mobile/Responsive Testing

- [ ] Open site on mobile phone
- [ ] Login works on mobile
- [ ] Navigation menu works
- [ ] Dashboard displays correctly
- [ ] Can execute audit on mobile
- [ ] Photo upload works on mobile

---

## Phase 13: Error Handling

- [ ] Disconnect internet → App shows offline message
- [ ] Submit form with missing required fields → Shows validation errors
- [ ] Session expired → Redirects to login
- [ ] API error → Shows user-friendly error message

---

## Bug Report Template

When you find a bug, note:

```
**Page**: Where did it happen?
**Steps**:
1. Step 1
2. Step 2
3. ...

**Expected**: What should happen?
**Actual**: What actually happened?
**Screenshot**: (if possible)
```

---

## Testing Progress Tracker

| Phase | Status | Bugs Found | Notes |
|-------|--------|------------|-------|
| 1. Authentication | 25% | 1 | Stack trace exposed |
| 2. Dashboard | Not Started | | |
| 3. Projects | Not Started | | |
| 4. Packages | Not Started | | |
| 5. Audits | Not Started | 1 | Evidence requirement disabled |
| 6. CAPA | Not Started | | |
| 7. KPI | Not Started | | |
| 8. Maturity | Not Started | | |
| 9. Reports | Not Started | | |
| 10. User Management | Not Started | | |
| 11. Role Access | Not Started | | |
| 12. Mobile | Not Started | | |
| 13. Error Handling | Not Started | | |

---

## Known Issues / Bugs Found

### BUG-001: Stack Trace Exposed in API Errors (SECURITY - HIGH)
**Page**: API responses
**Status**: Open
**Steps**:
1. Send invalid login request to `/api/v1/auth/login`
2. Observe response

**Expected**: Only error message shown
**Actual**: Full stack trace exposed in response:
```json
{"success":false,"message":"Invalid email or password","stack":"Error: Invalid email or password\n at AuthController.login..."}
```

**Root Cause**: `NODE_ENV=development` in `backend/.env` - should be `production`
**Fix**: Change `NODE_ENV=development` to `NODE_ENV=production` in `backend/.env`

---

### BUG-002: CORS Origin Missing Production URLs
**Page**: API Configuration
**Status**: Open
**Steps**:
1. Check `backend/.env` CORS_ORIGIN setting

**Expected**: Production URLs included
**Actual**: `CORS_ORIGIN=https://mahsr.protecther.in,http://localhost:3000,...`
Missing: `https://audit.protecther.in`

**Fix**: Add `https://audit.protecther.in` to CORS_ORIGIN

---

### BUG-003: Evidence Requirement Disabled for Audit Submission
**Page**: Audit Execution
**Status**: Open (TODO in code)
**File**: `backend/src/controllers/audit.controller.ts:361`

**Issue**: Non-compliant items can be submitted without evidence photos.
**Code Comment**: `// TODO: Re-enable evidence requirement for production`

---

### BUG-004: Password Reset Not Implemented
**Page**: Forgot Password
**Status**: Open
**File**: `backend/src/controllers/auth.controller.ts:156`

**Issue**: Password reset always returns "Invalid or expired reset token"

---

### BUG-005: Token Blacklisting Not Implemented
**Page**: Logout
**Status**: Open (Low Priority)
**File**: `backend/src/controllers/auth.controller.ts:88`

**Issue**: JWT tokens remain valid after logout until expiry.
**Comment in code**: `// In a production app, you might want to blacklist the token`

---

**Start with Phase 1 and work through each phase in order. Mark each checkbox as you complete it.**

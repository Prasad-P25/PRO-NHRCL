# PROTECTHER Audit Panel - Detailed Testing Checklist

**Tester**: _______________
**Date**: _______________
**Environment**: http://localhost:3000 (Dev) / https://audit.protecther.in (Prod)

---

## Test Credentials

| Role | Email | Password | Use For |
|------|-------|----------|---------|
| Super Admin | admin@protecther.com | admin123 | Full system testing |
| PMC Head | pmchead@protecther.com | demo123 | Approval workflows |
| Package Manager | manager.c2@protecther.com | demo123 | Package-level operations |
| Auditor | auditor1@protecther.com | demo123 | Audit execution |

---

## PHASE 1: AUTHENTICATION (Priority: HIGH)

### 1.1 Login - Valid Credentials

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Open http://localhost:3000 | Login page appears | | |
| 2 | Enter email: `admin@protecther.in` | Email field accepts input | | |
| 3 | Enter password: `admin123` | Password field shows dots | | |
| 4 | Click "Login" button | Loading indicator appears | | |
| 5 | Wait for response | Redirected to Dashboard | | |
| 6 | Check top-right corner | User name "Admin" shown | | |

### 1.2 Login - Invalid Credentials

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Enter email: `admin@protecther.in` | | | |
| 2 | Enter password: `wrongpassword` | | | |
| 3 | Click "Login" | Error message appears | | |
| 4 | Check error message | Says "Invalid credentials" (NOT stack trace) | | |

### 1.3 Login - Non-existent User

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Enter email: `doesnotexist@test.com` | | | |
| 2 | Enter password: `anything` | | | |
| 3 | Click "Login" | Error: "Invalid credentials" | | |

### 1.4 Session Persistence

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Login successfully | Dashboard shown | | |
| 2 | Press F5 (refresh page) | Still on Dashboard, still logged in | | |
| 3 | Open new browser tab | | | |
| 4 | Go to http://localhost:3000 | Dashboard shown (not login) | | |
| 5 | Close tab, return to original | Still logged in | | |

### 1.5 Logout

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click user menu (top-right) | Dropdown appears | | |
| 2 | Click "Logout" | Redirected to Login page | | |
| 3 | Press browser Back button | Should NOT go to Dashboard | | |
| 4 | Try URL: http://localhost:3000/audits | Redirected to Login | | |

### 1.6 Password Reset (if implemented)

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | On login page, click "Forgot Password" | Reset page/modal appears | | |
| 2 | Enter email: `admin@protecther.in` | | | |
| 3 | Click "Send Reset Link" | Success message appears | | |
| 4 | Check email (or logs) | Reset link received | | |

---

## PHASE 2: DASHBOARD (Priority: HIGH)

### 2.1 Dashboard Load

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Login as admin | Dashboard appears | | |
| 2 | Check page title | Shows "Dashboard" | | |
| 3 | Check for errors | No error messages | | |
| 4 | Check browser console (F12) | No red errors | | |

### 2.2 Dashboard Components

| Component | Check | Expected | Pass/Fail | Notes |
|-----------|-------|----------|-----------|-------|
| Compliance Card | Shows percentage | Number between 0-100% | | |
| Open NCs Card | Shows count | Number >= 0 | | |
| CAPA Status Card | Shows breakdown | Open/In Progress/Closed | | |
| KPI Gauges | Shows LTIFR/TRIFR | Numbers with benchmarks | | |
| Recent Audits | Shows list | Audit entries visible | | |
| Compliance Trend | Shows chart | Line/bar chart renders | | |

### 2.3 Project Selector

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Find project dropdown (header) | Current project shown | | |
| 2 | Click dropdown | List of projects appears | | |
| 3 | Select different project | Dashboard data refreshes | | |
| 4 | Check compliance % | Changes to new project's data | | |

---

## PHASE 3: AUDIT MANAGEMENT (Priority: CRITICAL)

### 3.1 View Audit List

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click "Audits" in sidebar | Audit list page loads | | |
| 2 | Check table columns | Shows: Audit#, Package, Date, Status, Compliance | | |
| 3 | Check pagination | Page numbers shown if >10 audits | | |

### 3.2 Filter Audits

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click Status filter dropdown | Options: All, Draft, In Progress, etc. | | |
| 2 | Select "Draft" | Only Draft audits shown | | |
| 3 | Select "Approved" | Only Approved audits shown | | |
| 4 | Clear filter | All audits shown again | | |

### 3.3 Create New Audit

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click "New Audit" button | New audit wizard opens | | |
| 2 | **Step 1**: Select Package | Package dropdown works | | |
| 3 | Select a package (e.g., C2) | Package selected, Next enabled | | |
| 4 | Click "Next" | Move to Step 2 | | |
| 5 | **Step 2**: Select Audit Type | Options shown (Full/Partial) | | |
| 6 | Select "Full Audit" | All categories auto-selected | | |
| 7 | Click "Next" | Move to Step 3 | | |
| 8 | **Step 3**: Select Categories | 18 categories shown | | |
| 9 | Categories are checked | At least some selected | | |
| 10 | Click "Next" | Move to Step 4 | | |
| 11 | **Step 4**: Set Date | Date picker shown | | |
| 12 | Select today's date | Date selected | | |
| 13 | Enter contractor rep name | Text field accepts input | | |
| 14 | Click "Create Audit" | Loading, then success | | |
| 15 | Check audit list | New audit appears as "Draft" | | |

**Record Audit Number Created**: _______________

### 3.4 Execute Audit (Fill Responses)

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click on Draft audit | Audit execution page opens | | |
| 2 | See category tabs/sections | Categories listed on left | | |
| 3 | Click first category | Checklist items appear | | |
| 4 | For Item 1: Click "Compliant" | Item marked green/C | | |
| 5 | For Item 2: Click "Non-Compliant" | Item marked red/NC | | |
| 6 | For Item 2: Add observation | Text field accepts input | | |
| 7 | For Item 2: Select Risk Rating | Dropdown works (Critical/Major/Minor) | | |
| 8 | For Item 3: Click "N/A" | Item marked grey/NA | | |
| 9 | Check progress indicator | Shows X% complete | | |
| 10 | Click different category | New items shown | | |
| 11 | Return to first category | Previous responses saved | | |

### 3.5 Upload Evidence for NC Item

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Find an NC item | Item marked red | | |
| 2 | Click "Add Evidence" or camera icon | File upload dialog appears | | |
| 3 | Select an image file | File uploads | | |
| 4 | Wait for upload | Preview shows | | |
| 5 | Check evidence count | Shows "1 evidence" | | |
| 6 | Click to view evidence | Image displays | | |

### 3.6 Submit Audit for Review

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Complete all audit items | 100% progress | | |
| 2 | Click "Submit for Review" | Confirmation dialog | | |
| 3 | If NC items without evidence | Error: "Evidence required for..." | | |
| 4 | Add evidence to all NC items | | | |
| 5 | Click "Submit" again | Success message | | |
| 6 | Check audit status | Changed to "Pending Review" | | |

### 3.7 Approve Audit (as PMC Head)

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Logout | Back to login | | |
| 2 | Login as `pmchead@protecther.com` | Dashboard loads | | |
| 3 | Go to Audits | List shown | | |
| 4 | Filter by "Pending Review" | Submitted audit shown | | |
| 5 | Click on audit | Audit details open | | |
| 6 | Click "Approve" | Confirmation dialog | | |
| 7 | Add approval comment (optional) | | | |
| 8 | Confirm approval | Success message | | |
| 9 | Check audit status | Changed to "Approved" | | |
| 10 | Try to edit responses | Should be LOCKED (read-only) | | |

### 3.8 Export Audit Report

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Open an Approved audit | Audit page loads | | |
| 2 | Click "Export" or download icon | Export options shown | | |
| 3 | Select "Export to Word" | File downloads | | |
| 4 | Open downloaded file | Word document opens | | |
| 5 | Check content | Audit details, responses, photos | | |

---

## PHASE 4: CAPA MANAGEMENT (Priority: HIGH)

### 4.1 View CAPA List

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click "CAPA" in sidebar | CAPA list page loads | | |
| 2 | Check columns | CAPA#, Finding, Status, Target Date | | |
| 3 | Check status badges | Color-coded (Open=blue, etc.) | | |
| 4 | Check overdue items | Highlighted in red | | |

### 4.2 CAPA Auto-Creation from Audit

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Create new audit | | | |
| 2 | Mark item as NC | | | |
| 3 | Check "CAPA Required" checkbox | Checkbox checked | | |
| 4 | Submit audit | | | |
| 5 | Go to CAPA list | New CAPA appears | | |
| 6 | Open CAPA | Linked to audit finding | | |

### 4.3 Update CAPA Details

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Open an Open CAPA | CAPA details shown | | |
| 2 | Enter Root Cause | Text field works | | |
| 3 | Enter Corrective Action | Text field works | | |
| 4 | Enter Preventive Action | Text field works | | |
| 5 | Set Responsible Person | Dropdown/text works | | |
| 6 | Set Target Date | Date picker works | | |
| 7 | Click Save | Success message | | |
| 8 | Reload page | Data persisted | | |

### 4.4 Close CAPA

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Open an In Progress CAPA | | | |
| 2 | Click "Close CAPA" | Dialog appears | | |
| 3 | Enter verification remarks | Required field | | |
| 4 | Click Confirm | Success message | | |
| 5 | Check status | Changed to "Closed" | | |
| 6 | Check closed date | Today's date | | |

### 4.5 CAPA Analytics

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click "CAPA Analytics" | Analytics page loads | | |
| 2 | Check Status Pie Chart | Shows Open/In Progress/Closed | | |
| 3 | Check Monthly Trend | Line chart renders | | |
| 4 | Check Overdue Count | Number shown | | |
| 5 | Check Top Overdue Table | List of overdue CAPAs | | |

---

## PHASE 5: KPI MANAGEMENT (Priority: MEDIUM)

### 5.1 View KPI Dashboard

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click "KPI" in sidebar | KPI dashboard loads | | |
| 2 | Check LTIFR display | Shows current value | | |
| 3 | Check TRIFR display | Shows current value | | |
| 4 | Check benchmark lines | Reference lines on charts | | |
| 5 | Check trend chart | Historical data shown | | |

### 5.2 KPI Data Entry

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Go to KPI Entry page | Entry form loads | | |
| 2 | Select Package | Dropdown works | | |
| 3 | Select Month/Year | Date selectors work | | |
| 4 | Enter Man-hours: 50000 | Field accepts numbers | | |
| 5 | Enter LTI Count: 1 | Field accepts numbers | | |
| 6 | Enter TRI Count: 2 | Field accepts numbers | | |
| 7 | Click Save | Success message | | |
| 8 | Go to KPI Dashboard | New data reflected | | |
| 9 | Check LTIFR calculation | = (1 × 1,000,000) / 50000 = 20 | | |

---

## PHASE 6: MATURITY ASSESSMENT (Priority: MEDIUM)

### 6.1 View Assessments

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click "Maturity" in sidebar | Assessment list loads | | |
| 2 | Check list columns | Package, Date, Score, Status | | |

### 6.2 Create Assessment

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click "New Assessment" | Assessment form opens | | |
| 2 | Select Package | Dropdown works | | |
| 3 | See 10 dimensions | All dimensions listed | | |
| 4 | Click first dimension | Questions appear | | |
| 5 | Rate question: Level 3 | Score selected | | |
| 6 | Add evidence text | Text field works | | |
| 7 | Complete all questions | Progress shows 100% | | |
| 8 | Click Submit | Success message | | |
| 9 | View radar chart | Spider chart renders | | |
| 10 | Check overall score | Average of all dimensions | | |

---

## PHASE 7: USER MANAGEMENT (Priority: HIGH)

### 7.1 View Users (Admin Only)

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Login as admin | | | |
| 2 | Go to Settings > Users | User list loads | | |
| 3 | Check columns | Name, Email, Role, Package, Status | | |
| 4 | Check pagination | Works if many users | | |

### 7.2 Create New User

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Click "Add User" | Form opens | | |
| 2 | Enter Name: Test User | Field works | | |
| 3 | Enter Email: testuser@test.com | Field works | | |
| 4 | Enter Password: Test@123 | Field works | | |
| 5 | Select Role: Auditor | Dropdown works | | |
| 6 | Select Package: C2 | Dropdown works | | |
| 7 | Click Create | Success message | | |
| 8 | Find user in list | User appears | | |
| 9 | Logout | | | |
| 10 | Login as testuser@test.com | Login successful | | |

### 7.3 Edit User

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Login as admin | | | |
| 2 | Go to Users, find test user | | | |
| 3 | Click Edit | Edit form opens | | |
| 4 | Change Role to Viewer | | | |
| 5 | Save | Success message | | |
| 6 | Login as test user | | | |
| 7 | Check permissions | Should have Viewer access only | | |

### 7.4 Deactivate User

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | As admin, find test user | | | |
| 2 | Click Deactivate/Delete | Confirmation dialog | | |
| 3 | Confirm | User deactivated | | |
| 4 | Try login as test user | Should FAIL - "Account disabled" | | |

---

## PHASE 8: ROLE-BASED ACCESS (Priority: HIGH)

### 8.1 Auditor Restrictions

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Login as `auditor1@protecther.com` | | | |
| 2 | Go to Audits | Can see audits | | |
| 3 | Create new audit | Should work | | |
| 4 | Try to access Settings > Users | Should be BLOCKED or hidden | | |
| 5 | Try to approve audit | Button should be HIDDEN | | |
| 6 | Try URL: /settings/users | Should redirect or show error | | |

### 8.2 Package Manager Restrictions

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Login as `manager.c2@protecther.com` | | | |
| 2 | Go to Audits | Only C2 package audits shown | | |
| 3 | Go to CAPA | Only C2 CAPAs shown | | |
| 4 | Try to create user | Should be BLOCKED | | |
| 5 | Close a CAPA | Should work | | |

### 8.3 PMC Head Access

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Login as `pmchead@protecther.com` | | | |
| 2 | Go to Audits | Can see ALL packages | | |
| 3 | Approve an audit | Should work | | |
| 4 | View reports | Cross-package reports work | | |

---

## PHASE 9: REPORTS (Priority: MEDIUM)

### 9.1 Generate Report

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Go to Reports page | Report options shown | | |
| 2 | Select "Compliance Summary" | | | |
| 3 | Select date range | Date pickers work | | |
| 4 | Click Generate | Report preview shown | | |

### 9.2 Export Reports

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Generate a report | Preview shown | | |
| 2 | Click "Export PDF" | PDF downloads | | |
| 3 | Open PDF | Content readable | | |
| 4 | Click "Export Excel" | Excel downloads | | |
| 5 | Open Excel | Data in columns | | |

---

## PHASE 10: ERROR HANDLING (Priority: MEDIUM)

### 10.1 Form Validation

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Create User with empty name | Error: "Name required" | | |
| 2 | Create User with invalid email | Error: "Valid email required" | | |
| 3 | Create Audit without package | Next button disabled | | |

### 10.2 API Errors

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Stop backend server | | | |
| 2 | Try to load dashboard | Error: "Network Error" or similar | | |
| 3 | Check error message | User-friendly (NOT stack trace) | | |
| 4 | Start backend again | | | |
| 5 | Refresh page | Works again | | |

### 10.3 Session Expiry

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Login successfully | | | |
| 2 | Wait 24+ hours OR manually clear localStorage | | | |
| 3 | Try any action | Redirected to login | | |
| 4 | Error message | "Session expired" or similar | | |

---

## PHASE 11: MOBILE TESTING (Priority: LOW)

### 11.1 Mobile Browser

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Open site on phone browser | Login page loads | | |
| 2 | Login works | Dashboard loads | | |
| 3 | Sidebar/menu works | Navigation accessible | | |
| 4 | Create audit on mobile | Wizard works | | |
| 5 | Upload photo from camera | Camera opens, upload works | | |

### 11.2 Responsive Design

| Step | Action | Expected Result | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| 1 | Resize browser to 375px width | Mobile layout | | |
| 2 | Tables become scrollable | Horizontal scroll | | |
| 3 | Charts resize | Still readable | | |
| 4 | Forms usable | Fields accessible | | |

---

## BUG REPORT TEMPLATE

When you find a bug, copy this template:

```
### BUG-XXX: [Short Description]

**Severity**: Critical / High / Medium / Low
**Page**: [URL or page name]
**User Role**: [Which user were you logged in as?]

**Steps to Reproduce**:
1.
2.
3.

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Screenshot**:
[Attach if possible]

**Browser**: Chrome / Firefox / Safari / Edge
**Date Found**:
```

---

## TESTING SUMMARY

| Phase | Total Tests | Passed | Failed | Blocked | % Complete |
|-------|-------------|--------|--------|---------|------------|
| 1. Authentication | 20 | | | | |
| 2. Dashboard | 12 | | | | |
| 3. Audits | 35 | | | | |
| 4. CAPA | 18 | | | | |
| 5. KPI | 10 | | | | |
| 6. Maturity | 12 | | | | |
| 7. User Management | 15 | | | | |
| 8. Role Access | 12 | | | | |
| 9. Reports | 8 | | | | |
| 10. Error Handling | 8 | | | | |
| 11. Mobile | 8 | | | | |
| **TOTAL** | **158** | | | | |

---

## SIGN-OFF

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tester | | | |
| Developer | | | |
| Project Manager | | | |

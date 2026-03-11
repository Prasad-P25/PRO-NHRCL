# Bug Fix Verification Guide

**Date**: 2026-03-11
**Tester**: _______________

This guide helps you verify that the bugs have been fixed. Follow each step carefully.

---

## BUG-001: Stack Trace No Longer Exposed (SECURITY FIX)

### What was the problem?
When someone entered wrong login details, the system was showing technical error details (called "stack trace") that hackers could use to attack the system.

### How to test (Step by Step):

**Step 1**: Open your web browser (Chrome, Edge, or Firefox)

**Step 2**: Go to https://audit.protecther.in

**Step 3**: On the login page, enter:
- Email: `fakeemail@test.com`
- Password: `wrongpassword`

**Step 4**: Click the "Login" button

**Step 5**: Check what happens:

| What You See | Result |
|--------------|--------|
| Just shows "Invalid email or password" message | PASS - Bug is fixed |
| Shows long technical text with "Error:", "at AuthController", file paths | FAIL - Bug not fixed |

**Your Result**: [ ] PASS  [ ] FAIL

---

## BUG-002: Website Loads Correctly (CORS FIX)

### What was the problem?
The website might not load properly because the server was blocking requests from the correct web address.

### How to test (Step by Step):

**Step 1**: Open your web browser

**Step 2**: Go to https://audit.protecther.in

**Step 3**: Check if the login page loads:

| What You See | Result |
|--------------|--------|
| Login page loads with email/password fields | PASS - Bug is fixed |
| Blank page or "CORS error" in browser | FAIL - Bug not fixed |

**Your Result**: [ ] PASS  [ ] FAIL

**Step 4**: Login with valid credentials:
- Email: `admin@protecther.in`
- Password: `admin123`

**Step 5**: Check if dashboard loads:

| What You See | Result |
|--------------|--------|
| Dashboard loads with data and charts | PASS - Bug is fixed |
| Blank page, errors, or data not loading | FAIL - Bug not fixed |

**Your Result**: [ ] PASS  [ ] FAIL

---

## BUG-003: Evidence Requirement (NOT YET FIXED)

### What is the problem?
Auditors can submit non-compliant items without uploading evidence photos.

### Status: Open - To be fixed later

---

## BUG-004: Password Reset (NOT YET FIXED)

### What is the problem?
The "Forgot Password" feature does not work.

### Status: Open - To be fixed later

---

## BUG-005: Logout Token (LOW PRIORITY)

### What is the problem?
After logout, the session token stays valid until it expires (24 hours).

### Status: Open - Low priority

---

## Summary

| Bug | Description | Status | Verified |
|-----|-------------|--------|----------|
| BUG-001 | Stack trace exposed | FIXED | [ ] Yes [ ] No |
| BUG-002 | CORS missing URL | FIXED | [ ] Yes [ ] No |
| BUG-003 | Evidence not required | OPEN | - |
| BUG-004 | Password reset broken | OPEN | - |
| BUG-005 | Token not blacklisted | OPEN (Low) | - |

---

**Tester Signature**: _______________
**Date Tested**: _______________

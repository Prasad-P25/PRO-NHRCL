# Bug Fix Verification Guide

**Last Updated**: 2026-03-29

---

## Summary

| Bug | Description | Status | Fixed Date |
|-----|-------------|--------|------------|
| BUG-001 | Stack trace exposed in errors | ✅ FIXED | 2026-03-11 |
| BUG-002 | CORS missing production URL | ✅ FIXED | 2026-03-11 |
| BUG-003 | Evidence not required for NC items | ✅ FIXED | 2026-03-29 |
| BUG-004 | Password reset not working | ✅ FIXED | 2026-03-29 |
| BUG-005 | Token not blacklisted on logout | ✅ FIXED | 2026-03-29 |
| BUG-006 | Trust proxy not configured | ✅ FIXED | 2026-03-29 |

**All bugs are now fixed!**

---

## BUG-001: Stack Trace No Longer Exposed ✅ FIXED

**Problem**: Technical error details exposed to users on login failure.

**Fix**: Set `NODE_ENV=production` in `backend/.env`

**Verification**:
1. Go to https://audit.protecther.in
2. Enter wrong login credentials
3. Should only see "Invalid email or password" (no stack trace)

---

## BUG-002: CORS Configuration ✅ FIXED

**Problem**: Production URL missing from CORS whitelist.

**Fix**: Added `https://audit.protecther.in` to `CORS_ORIGIN` in `backend/.env`

**Verification**:
1. Go to https://audit.protecther.in
2. Login page should load correctly
3. Login should work without CORS errors

---

## BUG-003: Evidence Required for NC Items ✅ FIXED

**Problem**: Auditors could submit non-compliant items without evidence photos.

**Fix**: Uncommented validation code in `backend/src/controllers/audit.controller.ts:372`

**Verification**:
1. Create an audit
2. Mark an item as Non-Compliant (NC) without uploading evidence
3. Try to submit audit
4. Should get error: "Cannot submit audit. The following NC items require evidence..."

---

## BUG-004: Password Reset ✅ FIXED

**Problem**: Password reset always returned "Invalid or expired reset token".

**Fix**:
- Added `reset_token` and `reset_token_expires` columns to users table
- Implemented full token generation with SHA-256 hashing
- Token expires in 1 hour
- Reset URL logged (in production, send via email)

**Files Changed**:
- `backend/src/controllers/auth.controller.ts`
- `backend/src/database/migrations/003-add-password-reset.ts`

**Verification**:
1. Call POST `/api/v1/auth/forgot-password` with valid email
2. Check server logs for reset URL with token
3. Call POST `/api/v1/auth/reset-password` with token and new password
4. Login with new password should work

---

## BUG-005: Token Blacklisting on Logout ✅ FIXED

**Problem**: JWT tokens remained valid after logout until expiry.

**Fix**:
- Created `backend/src/utils/tokenBlacklist.ts` (in-memory blacklist)
- Modified logout to add token to blacklist
- Modified auth middleware to check blacklist
- Tokens auto-expire from blacklist after 24 hours

**Files Changed**:
- `backend/src/utils/tokenBlacklist.ts` (NEW)
- `backend/src/controllers/auth.controller.ts`
- `backend/src/middleware/auth.ts`

**Verification**:
1. Login and get token
2. Logout
3. Try using the same token - should get "Token has been revoked"

---

## BUG-006: Trust Proxy Configuration ✅ FIXED

**Problem**: Express `trust proxy` was false, causing rate limiter warnings behind Cloudflare.

**Fix**: Added `app.set('trust proxy', 1)` in `backend/src/index.ts`

**Verification**:
1. Check server logs
2. No more "X-Forwarded-For header is set but trust proxy is false" warnings

---

## All Bugs Verified Fixed: 2026-03-29

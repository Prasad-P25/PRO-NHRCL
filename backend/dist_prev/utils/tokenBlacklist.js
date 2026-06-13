"use strict";
// In-memory token blacklist
// Tokens are automatically removed after they would have expired anyway
// For a distributed system, use Redis instead
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenBlacklist = void 0;
class TokenBlacklist {
    constructor() {
        this.blacklist = new Map();
        this.cleanupInterval = null;
        // Clean up expired tokens every hour
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }
    // Add a token to the blacklist
    add(token, expiresInMs = 24 * 60 * 60 * 1000) {
        const expiresAt = Date.now() + expiresInMs;
        this.blacklist.set(token, expiresAt);
    }
    // Check if a token is blacklisted
    isBlacklisted(token) {
        const expiresAt = this.blacklist.get(token);
        if (!expiresAt)
            return false;
        // If expired, remove it and return false
        if (Date.now() > expiresAt) {
            this.blacklist.delete(token);
            return false;
        }
        return true;
    }
    // Remove expired tokens
    cleanup() {
        const now = Date.now();
        for (const [token, expiresAt] of this.blacklist.entries()) {
            if (now > expiresAt) {
                this.blacklist.delete(token);
            }
        }
    }
    // Get blacklist size (for monitoring)
    size() {
        return this.blacklist.size;
    }
    // Clear all tokens (for testing)
    clear() {
        this.blacklist.clear();
    }
}
// Singleton instance
exports.tokenBlacklist = new TokenBlacklist();
//# sourceMappingURL=tokenBlacklist.js.map